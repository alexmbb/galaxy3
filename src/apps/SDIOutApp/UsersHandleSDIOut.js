import React, {Component} from 'react';
import './UsersHandleSDIOut.scss'
import { Janus } from "../../lib/janus";
import classNames from "classnames";

class UsersHandleSDIOut extends Component {

    state = {
        feeds: [],
        feedStreams: {},
        mids: [],
        name: "",
        room: "",
        users: {},
        myid: null,
    };

    componentDidUpdate(prevProps) {
        let {g,ce} = this.props;
        let {room} = this.state;
        if(g && JSON.stringify(g) !== JSON.stringify(prevProps.g) && g.room !== room) {
            if(room) {
                this.exitVideoRoom(room, () =>{
                    this.initVideoRoom(g.room, g.janus);
                });
            } else {
                this.initVideoRoom(g.room, g.janus);
            }
        }
        if(ce && JSON.stringify(ce) !== JSON.stringify(prevProps.ce) && ce.room === room && ce.camera) {
            let {feedStreams} = this.state;
            let remotevideo = this.refs["pv" + ce.rfid];
            if(remotevideo && feedStreams[ce.rfid] && feedStreams[ce.rfid].stream)
                Janus.attachMediaStream(remotevideo, feedStreams[ce.rfid].stream);
        }
    }

    componentWillUnmount() {
        this.exitVideoRoom(this.state.room, () =>{})
    };

    initVideoRoom = (roomid, inst) => {
        const gateway = this.props.gateways[inst];
        gateway.gateway.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "preview_shidur",
            success: (videoroom) => {
                gateway.log(`[room ${roomid}] attach success`, videoroom.getId());
                this.setState({room: roomid, videoroom, remoteFeed: null});
                let {user} = this.props;
                let register = { "request": "join", "room": roomid, "ptype": "publisher", "display": JSON.stringify(user) };
                videoroom.send({"message": register});
            },
            error: (err) => {
                gateway.error(`[room ${roomid}] attach error`, err);
            },
            consentDialog: (on) => {
                gateway.debug(`[room ${roomid}] consent dialog should be ${on ? "on" : "off"} now`);
            },
            mediaState: (medium, on) => {
                gateway.log(`[room ${roomid}] Janus ${on ? "started" : "stopped"} receiving our ${medium}`);
            },
            webrtcState: (on) => {
                gateway.log(`[room ${roomid}] Janus says our WebRTC PeerConnection is ${on ? "up" : "down"} now`);
            },
            slowLink: (uplink, lost, mid) => {
                gateway.warn(`[room ${roomid}] Janus reports problems ${(uplink ? "sending" : "receiving")} packets on mid ${mid} (${lost} lost packets)`);
            },
            onmessage: (msg, jsep) => {
                this.onMessage(gateway, roomid, msg, jsep);
            },
            onlocalstream: (mystream) => {
                gateway.log(`[room ${roomid}] ::: Got a local stream :::`, mystream);
            },
            oncleanup: () => {
                gateway.log(`[room ${roomid}] ::: Got a cleanup notification: we are unpublished now :::`);
            }
        });
    };

    exitVideoRoom = (roomid, callback) => {
        if(this.state.videoroom) {
            let leave_room = {request : "leave", "room": roomid};
            this.state.videoroom.send({"message": leave_room,
                success: () => {
                    this.state.videoroom.detach();
                    if(this.state.remoteFeed)
                        this.state.remoteFeed.detach();
                    callback();
                }
            });
        }
    };

    onMessage = (gateway, roomid, msg, jsep) => {
        gateway.debug(`[room ${roomid}] ::: Got a message (publisher) :::`, msg);
        let event = msg["videoroom"];
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid, mypvtid});
                console.debug(`[SDIOut] [room ${roomid}] Successfully joined room`, myid);
                if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    //FIXME: Tmp fix for black screen in room caoused by feed with video_codec = none
                    let feeds         = list.sort((a, b) => JSON.parse(a.display).timestamp - JSON.parse(b.display).timestamp)
                        .filter(feeder => JSON.parse(feeder.display).role === 'user' && feeder.video_codec !== 'none');
                    let {feedStreams} = this.state;
                    let {users} = this.props;
                    console.log(`[SDIOut] [room ${roomid}] :: Got publishers list: `, feeds);
                    let subscription = [];
                    for (let f in feeds) {
                        let id = feeds[f]["id"];
                        let display = JSON.parse(feeds[f]["display"]);
                        let talk = feeds[f]["talking"];
                        let streams = feeds[f]["streams"];
                        feeds[f].display = display;
                        feeds[f].talk = talk;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if (stream.type === "video") {
                                subst.mid = stream.mid;
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = {...display, ...users[display.id], rfid: id};
                        subscription.push(subst);
                    }
                    this.setState({feeds, feedStreams, users});
                    if (subscription.length > 0) {
                        this.props.setProps({users});
                        this.subscribeTo(gateway, roomid, subscription);
                    }
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                console.log(`[SDIOut] [room ${roomid}] started talking`, id);
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = true;
                        this.setState({feeds});
                    }
                }
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                console.log(`[SDIOut] [room ${roomid}] stopped talking`, id);
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = false;
                        this.setState({feeds});
                    }
                }
            } else if(event === "destroyed") {
                console.warn(`[SDIOut] [room ${roomid}] room destroyed!`);
            } else if(event === "event") {
                let {feedStreams,user,myid} = this.state;
                if(msg["streams"] !== undefined && msg["streams"] !== null) {
                    let streams = msg["streams"];
                    for (let i in streams) {
                        let stream = streams[i];
                        stream["id"] = myid;
                        stream["display"] = user;
                    }
                    feedStreams[myid] = {id: myid, display: user, streams: streams};
                    this.setState({feedStreams})
                } else if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let feed = msg["publishers"];
                    let {feeds,feedStreams} = this.state;
                    let {users} = this.props;
                    gateway.log(`[SDIOut] [room ${roomid}] :: Got publishers list: `, feeds);
                    let subscription = [];
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== "user")
                            return;
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if(stream.type === "video") {
                                subst.mid = stream.mid;
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = {...display, ...users[display.id], rfid: id};
                        subscription.push(subst);
                    }
                    feeds.push(feed[0]);
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0) {
                        this.subscribeTo(gateway, roomid, subscription);
                        this.props.setProps({users});
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    let leaving = msg["leaving"];
                    console.log(`[SDIOut] [room ${roomid}] Publisher left`, leaving);
                    this.unsubscribeFrom(leaving);

                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    let unpublished = msg["unpublished"];
                    console.log(`[SDIOut] [room ${roomid}] Publisher left`, unpublished);
                    if(unpublished === 'ok') {
                        this.state.videoroom.hangup();
                        return;
                    }
                    this.unsubscribeFrom(unpublished);

                } else if(msg["error"] !== undefined && msg["error"] !== null) {
                    if(msg["error_code"] === 426) {
                        console.error(`[SDIOut] [room ${roomid}] no such room`);
                    } else {
                        console.error(`[SDIOut] [room ${roomid}] no such room`, msg["error"]);
                    }
                }
            }
        }
        if(jsep !== undefined && jsep !== null) {
            gateway.debug(`[room ${roomid}] Handling SDP as well...`, jsep);
            this.state.videoroom.handleRemoteJsep({jsep});
        }
    };

    newRemoteFeed = (gateway, roomid, subscription) => {
        gateway.gateway.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_user",
                success: (pluginHandle) => {
                    gateway.log(`[room ${roomid}] [remoteFeed] attach success`, pluginHandle.getId());
                    let remoteFeed = pluginHandle;
                    this.setState({remoteFeed, creatingFeed: false});
                    let subscribe = {request: "join", room: this.state.room, ptype: "subscriber", streams: subscription};
                    remoteFeed.send({ message: subscribe });
                },
                error: (err) => {
                    gateway.error(`[room ${roomid}] [remoteFeed] attach error`, err);
                },
                iceState: (state) => {
                    gateway.log(`[room ${roomid}] [remoteFeed] ICE state changed to`, state);
                },
                webrtcState: (on) => {
                    gateway.log(`[room ${roomid}] [remoteFeed] Janus says this WebRTC PeerConnection is ${on ? "up" : "down"} now`);
                },
                slowLink: (uplink, nacks) => {
                    gateway.warn(`[room ${roomid}] [remoteFeed] Janus reports problems ` + (uplink ? "sending" : "receiving") +
                        " packets on this PeerConnection (remote feed, " + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
                },
                onmessage: (msg, jsep) => {
                    let event = msg["videoroom"];
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        console.error(`[SDIOut] [room ${roomid}] [remoteFeed] error`, msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            console.debug(`[SDIOut] [room ${roomid}] [remoteFeed] successfully attached to feed in room`);
                        } else if(event === "event") {
                            // Check if we got an event on a simulcast-related event from this publisher
                        } else {
                            // What has just happened?
                        }
                    }
                    if(msg["streams"]) {
                        let {mids} = this.state;
                        for(let i in msg["streams"]) {
                            let mindex = msg["streams"][i]["mid"];
                            mids[mindex] = msg["streams"][i];
                        }
                        this.setState({mids});
                    }
                    if(jsep !== undefined && jsep !== null) {
                        gateway.debug(`[room ${roomid}] [remoteFeed] Handling SDP as well...`, jsep);
                        // Answer and attach
                        this.state.remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                media: { audioSend: false, videoSend: false },
                                success: (jsep) => {
                                    gateway.debug(`[room ${roomid}] [remoteFeed] Got SDP!`, jsep);
                                    let body = { request: "start", room: this.state.room };
                                    this.state.remoteFeed.send({ message: body, jsep: jsep });
                                },
                                error: (err) => {
                                    gateway.error(`[room ${roomid}][remoteFeed]  WebRTC error`, err);
                                }
                            });
                    }
                },
                onremotetrack: (track, mid, on) => {
                    let {mids,feedStreams} = this.state;
                    let feed = mids[mid].feed_id;
                    if(track.kind === "video" && on) {
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        feedStreams[feed].stream = stream;
                        this.setState({feedStreams});
                        let remotevideo = this.refs["pv" + feed];
                        if(remotevideo)
                            Janus.attachMediaStream(remotevideo, stream);
                    }
                },
                ondataopen: (data) => {
                    gateway.debug(`[room ${roomid}] [remoteFeed] The DataChannel is available!`);
                },
                ondata: (data) => {
                    gateway.debug(`[room ${roomid}] [remoteFeed] We got data from the DataChannel!`, data);
                },
                oncleanup: () => {
                    gateway.debug(`[room ${roomid}] [remoteFeed] ::: Got a cleanup notification :::`);
                }
            });
    };

    subscribeTo = (gateway, roomid, subscription) => {
        if (this.state.remoteFeed) {
            this.state.remoteFeed.send({message:
                    {request: "subscribe", streams: subscription}
            });
            return;
        }
        if (this.state.creatingFeed) {
            setTimeout(() => {
                this.subscribeTo(gateway, roomid, subscription);
            }, 500);
        } else {
            this.setState({creatingFeed: true});
            this.newRemoteFeed(gateway, roomid, subscription);
        }
    };

    unsubscribeFrom = (id) => {
        let {feeds,users,feedStreams} = this.state;
        let {remoteFeed} = this.state;
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                console.log("[SDIOut] Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                delete users[feeds[i].display.id];
                delete feedStreams[id];
                feeds.splice(i, 1);
                let unsubscribe = {request: "unsubscribe", streams: [{ feed: id }]};
                if(remoteFeed !== null)
                    remoteFeed.send({ message: unsubscribe });
                this.setState({feeds,users,feedStreams});
                break
            }
        }
    };

  render() {
      const {feeds} = this.state;
      const {users} = this.props;
      const width = "400";
      const height = "300";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      //const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);

      let program_feeds = feeds.map((feed) => {
          let camera = users[feed.display.id] && users[feed.display.id].camera !== false;
          if(feed && camera) {
              let id = feed.id;
              let talk = feed.talk;
              //let question = users[feed.display.id] && users[feed.display.id].question;
              //let st = users[feed.display.id] && users[feed.display.id].sound_test;
              return (<div className="video"
                           key={"prov" + id}
                           ref={"provideo" + id}
                           id={"provideo" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})}>
                      {/*{question ? <div className="question">*/}
                      {/*    <svg viewBox="0 0 50 50">*/}
                      {/*        <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>*/}
                      {/*    </svg>*/}
                      {/*    {st ? <Icon name="checkmark" size="small" color="green"/> : ''}*/}
                      {/*</div>:''}*/}
                  </div>
                  <video className={talk ? "talk" : ""}
                         key={id}
                         ref={"pv" + id}
                         id={"pv" + id}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         muted={muted}
                         playsInline={true}/>
              </div>);
          }
          return true;
      });

      return (
          <div className="videos-panel">
              <div className="videos">
                  <div className="videos__wrapper">
                      {program_feeds}
                  </div>
              </div>
          </div>
      );
  }
}

export default UsersHandleSDIOut;
