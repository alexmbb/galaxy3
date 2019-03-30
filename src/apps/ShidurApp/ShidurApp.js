import React, {Component} from 'react';
import {Janus} from "../../lib/janus";
import {Grid} from "semantic-ui-react";
import {getDateString, initJanus} from "../../shared/tools";
import {initGxyProtocol, sendProtocolMessage} from "../../shared/protocol";
import ShidurGroups from "./ShidurGroups";
//import ShidurUsers from "./ShidurUsers";
import {client, getUser} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import './ShidurApp.css';
import ShidurToran from "./ShidurToran";


class ShidurApp extends Component {

    state = {
        qam: {0:1,1:2,2:3,3:1,4:2,5:3,6:1,7:2,8:3,9:1,10:2,11:3},
        janus: null,
        feeds: [],
        feedStreams: {},
        mids: [],
        qfeeds: [],
        log_list: [],
        gxyhandle: null,
        name: "",
        disabled_groups: [],
        group: null,
        pri: null,
        pr1: [],
        pre: null,
        program: null,
        pre_feed: null,
        full_feed: null,
        protocol: null,
        pgm_state: [],
        quistions_queue: [],
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: true,
        feeds_queue: 0,
        user: null,
        users: {},
        zoom: false,
        fullscr: false,
        round: 0,
        sdiout: false,
        sndman: false,
    };

    componentDidMount() {
        getUser(user => {
            if(user) {
                let gxy_group = user.roles.filter(role => role === 'gxy_shidur').length > 0;
                if (gxy_group) {
                    delete user.roles;
                    user.role = "shidur";
                    this.initGalaxy(user);
                } else {
                    alert("Access denied!");
                    client.signoutRedirect();
                }
            }
        });
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initGalaxy = (user) => {
        initJanus(janus => {
            this.setState({janus,user});

            initGxyProtocol(janus, user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.debug("-- :: It's protocol public message: ", ondata);
                if(ondata.type === "error" && ondata.error_code === 420) {
                    alert(ondata.error);
                    this.state.protocol.hangup();
                } else if(ondata.type === "joined") {
                    this.initVideoRoom();
                }
                this.onProtocolData(ondata);
            });

        },er => {
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }, true);
    };

    initVideoRoom = () => {
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "preview_shidur",
            success: (gxyhandle) => {
                Janus.log(gxyhandle);
                this.setState({gxyhandle});
                Janus.log("Plugin attached! (" + gxyhandle.getPlugin() + ", id=" + gxyhandle.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": JSON.stringify(user) };
                gxyhandle.send({"message": register});
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            consentDialog: (on) => {
                Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
            },
            mediaState: (medium, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            onmessage: (msg, jsep) => {
                this.onMessage(msg, jsep, false);
            },
            onlocalstream: (mystream) => {
                Janus.debug(" ::: Got a local stream :::", mystream);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    onMessage = (msg, jsep, initdata) => {
        let {gxyhandle} = this.state;
        Janus.debug(" ::: Got a message (publisher) :::");
        Janus.debug(msg);
        let event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let {feedStreams,users} = this.state;
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "group");

                    let subscription = [];
                    for(let f in feeds) {
                        let id = feeds[f]["id"];
                        let display = JSON.parse(feeds[f]["display"]);
                        //let talk = feeds[f]["talking"];
                        let streams = feeds[f]["streams"];
                        feeds[f].display = display;
                        //feeds[f].talk = talk;
                        for (let i in streams) {
                            let stream = streams[i];
                            if(stream.type === "video" && subscription.length < 12) {
                                let subst = {feed: id};
                                stream["id"] = id;
                                stream["display"] = display;
                                subst.mid = stream.mid;
                                subscription.push(subst);
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                    }
                    this.setState({feeds,feedStreams,users});
                    // Set next feed in queue first after program is full
                    if(feeds.length > 12) {
                        this.setState({feeds_queue: 13});
                    }
                    if(subscription.length > 0)
                        this.subscribeTo(subscription);

                    // getState('state/galaxy/pr1', (pgm_state) => {
                    //     Janus.log(" :: Get State: ", pgm_state);
                    //     this.setState({pgm_state});
                    //     pgm_state.forEach((feed,i) => {
                    //         let chk = feeds.filter(f => f.id === feed.id).length > 0;
                    //         if(chk)
                    //             this.newSwitchFeed(feed.id,true,i);
                    //     });
                    // });
                }
            } else if(event === "talking") {
                //let id = msg["id"];
                //Janus.log("User: "+id+" - start talking");
            } else if(event === "stopped-talking") {
                //let id = msg["id"];
                //Janus.log("User: "+id+" - stop talking");
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let feed = msg["publishers"];
                    let {feeds,feedStreams,users} = this.state;
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(feed);
                    let subscription = [];
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== "group")
                            return;
                        //let talk = feed[f]["talking"];
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        for (let i in streams) {
                            let stream = streams[i];
                            if(stream.type === "video") {
                                let subst = {feed: id};
                                stream["id"] = id;
                                stream["display"] = display;
                                subst.mid = stream.mid;
                                subscription.push(subst);
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                    }
                    feeds.push(feed[0]);
                    this.setState({feeds,feedStreams,users});
                    this.actionLog(feed[0].display, "enter");
                    // Set next feed in queue first after program is full
                    if(feeds.length === 13) {
                        this.setState({feeds_queue: 13});
                    }
                    // Subscribe until program full
                    if(feeds.length < 13 && subscription.length > 0) {
                        this.subscribeTo(subscription);
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    console.log("Publisher left: " + leaving);
                    this.removeFeed(leaving);
                    // Delete from disabled_groups
                    let {disabled_groups} = this.state;
                    for(let i = 0; i < disabled_groups.length; i++){
                        if(disabled_groups[i].id === leaving) {
                            disabled_groups.splice(i, 1);
                            this.setState({disabled_groups});
                            break
                        }
                    }
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    console.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        this.state.gxyhandle.hangup();
                        return;
                    }
                    this.removeFeed(unpublished);
                    // Delete from disabled_groups
                    let {disabled_groups} = this.state;
                    for(let i = 0; i < disabled_groups.length; i++){
                        if(disabled_groups[i].id === unpublished) {
                            disabled_groups.splice(i, 1);
                            this.setState({disabled_groups});
                            break
                        }
                    }
                } else if(msg["error"] !== undefined && msg["error"] !== null) {
                    if(msg["error_code"] === 426) {
                        Janus.log("This is a no such room");
                    } else {
                        Janus.log(msg["error"]);
                    }
                }
            }
        }
        if(jsep !== undefined && jsep !== null) {
            Janus.debug("Handling SDP as well...");
            Janus.debug(jsep);
            gxyhandle.handleRemoteJsep({jsep: jsep});
        }
    };

    actionLog = (user, text) => {
        let {log_list} = this.state;
        let time = getDateString();
        let log = {time, user, text};
        log_list.push(log);
        this.setState({log_list});
    };

    newRemoteFeed = (subscription) => {
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "switchfeed_user",
                success: (pluginHandle) => {
                    let remoteFeed = pluginHandle;
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a multistream subscriber",remoteFeed);
                    this.setState({remoteFeed, creatingFeed: false});
                    let subscribe = { "request": "join", "room": 1234, "ptype": "subscriber", streams: subscription };
                    remoteFeed.send({"message": subscribe});
                },
                error: (error) => {
                    Janus.error("  -- Error attaching plugin...", error);
                },
                iceState: (state) => {
                    Janus.log("ICE state (remote feed) changed to " + state);
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (remote feed) is " + (on ? "up" : "down") + " now");
                },
                slowLink: (uplink, nacks) => {
                    Janus.warn("Janus reports problems " + (uplink ? "sending" : "receiving") +
                        " packets on this PeerConnection (remote feed, " + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
                },
                onmessage: (msg, jsep) => {
                    Janus.debug(" ::: Got a message (subscriber) :::");
                    Janus.debug(msg);
                    let event = msg["videoroom"];
                    Janus.debug("Event: " + event);
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        Janus.debug(":: Error msg: " + msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            // Subscriber created and attached
                            Janus.log("Successfully attached to feed in room " + msg["room"]);
                        } else {
                            // What has just happened?
                        }
                    }
                    if(msg["streams"]) {
                        // Update map of subscriptions by mid
                        Janus.log(" :: Streams updated! : ",msg["streams"]);
                        let {mids,pre_feed,program} = this.state;
                        for(let i in msg["streams"]) {
                            let mindex = msg["streams"][i]["mid"];
                            mids[mindex] = msg["streams"][i];
                            if(mids[mindex].active) {
                                mids[mindex].user = JSON.parse(msg["streams"][i]["feed_display"]);
                            }
                        }
                        this.setState({mids}, () => {
                            this.fillProgram(pre_feed,program);
                        });
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        let {remoteFeed} = this.state;
                        // Answer and attach
                        remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                media: { audio: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": 1234 };
                                    remoteFeed.send({"message": body, "jsep": jsep});
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                }
                            });
                    }
                },
                onlocalstream: (stream) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotetrack: (track,mid,on) => {
                    Janus.log(" ::: Got a remote track event ::: (remote feed)");
                    Janus.log("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                    // Which publisher are we getting on this mid?
                    let {mids,feedStreams,qam} = this.state;
                    let feed = mids[mid].feed_id;
                    Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                    if(!on) {
                        console.log(" :: Going to stop track :: " + track + ":", mid);
                        //FIXME: Remove callback for audio track does not come
                        track.stop();
                        //FIXME: does we really need to stop all track for feed id?
                        return;
                    }
                    if(track.kind !== "video" || !on) {
                        return;
                    }
                    let stream = new MediaStream();
                    stream.addTrack(track.clone());
                    feedStreams[feed].stream = stream;
                    this.setState({feedStreams});
                    //let col = "col" + (mid < 4 ? 1 : mid < 8 ? 2 : mid < 12 ? 3 : 4);
                    let col = "col" + qam[mid];
                    let video = this[col].refs["programVideo" + mid];
                    Janus.log(" Attach remote stream on video: "+mid);
                    Janus.attachMediaStream(video, stream);
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed) :::");
                }
            });
    };

    subscribeTo = (subscription) => {
        // New feeds are available, do we need create a new plugin handle first?
        Janus.log(" -- Going to subscribe: ",subscription);
        if (this.state.remoteFeed) {
            this.state.remoteFeed.send({message:
                    {request: "subscribe", streams: subscription}
            });
            return;
        }

        // We don't have a handle yet, but we may be creating one already
        if (this.state.creatingFeed) {
            // Still working on the handle
            setTimeout(() => {
                this.subscribeTo(subscription);
            }, 500);
            return;
        }

        // We don't creating, so let's do it
        this.setState({creatingFeed: true});
        this.newRemoteFeed(subscription);
    };

    onProtocolData = (data) => {
        if(data.type === "question" && data.status) {
            let {quistions_queue,users,qfeeds,mids} = this.state;
            if(users[data.user.id]) {
                users[data.user.id].question = true;
                data.rfid = users[data.user.id].rfid;
                let q = {id: data.rfid, display: data.user};
                quistions_queue.push(data);
                // TODO: We need to check disabled list as well

                // Check if qfeed already in program
                let chk = mids.find(q => q.feed_id === data.rfid);

                if(!chk) {
                    qfeeds.push(q);
                } else {
                    //TODO: Here we reattach same feed to fix delay after many switch requests
                    //
                    // for(let i = 0; i < pgm_state.length; i++){
                    //     let c = 0;
                    //     // FIXME: Array with null will do crash here!
                    //     if(pgm_state[i].id === chk[c].id) {
                    //         pr1[i].detach();
                    //         pr1[i] = null;
                    //         if(i < 4) {
                    //             this.col1.switchNext(i,chk[0]);
                    //         } else if(i < 8) {
                    //             this.col2.switchNext(i,chk[0]);
                    //         } else if(i < 12) {
                    //             this.col3.switchNext(i,chk[0]);
                    //         }
                    //         if(chk.length > 1) {
                    //             c++
                    //         }
                    //     }
                    // }
                }

                this.setState({quistions_queue, users, qfeeds});
            }
        } else if(data.type === "question" && !data.status) {
            // TODO: We need to check disabled list as well
            let {quistions_queue,users,qfeeds} = this.state;
            for(let i = 0; i < quistions_queue.length; i++){
                if(quistions_queue[i].user.id === data.user.id) {
                    users[data.user.id].question = false;
                    quistions_queue.splice(i, 1);
                    qfeeds.splice(i, 1);
                    this.setState({quistions_queue,users});
                    break
                }
            }
            for(let i = 0; i < qfeeds.length; i++) {
                if(qfeeds[i].display.id === data.user.id) {
                    qfeeds.splice(i, 1);
                    this.setState({qfeeds});
                    break
                }
            }
        } else if(data.type === "event") {
            delete data.type;
            this.setState({...data});
            if(data.sdiout || data.sndman) {
                this.col1.sdiAction("state",this.state.pgm_state,1, data);
            }
        }
    };

    checkPreview = (id) => {
        let {pre_feed} = this.state;
        if(pre_feed && pre_feed.id === id) {
            this.setState({pre_feed: null});
        }
    };

    unsubscribeFrom = (streams, id) => {
        Janus.log(" :: Going to unsubscribe: ",streams);
        let {remoteFeed} = this.state;

        // Remove feed from preview
        if(id) this.checkPreview(id);

        Janus.debug(" -- Sending request with data: ",streams);
        let unsubscribe = {request: "unsubscribe", streams};
        if(remoteFeed !== null)
            remoteFeed.send({ message: unsubscribe });
    };

    removeFeed = (id, disable) => {
        let {feeds,users,quistions_queue,qfeeds,feeds_queue} = this.state;

        // Clean preview
        this.checkPreview(id);

        for(let i=0; i<feeds.length; i++) {
            if(feeds[i].id === id) {
                // Delete from users mapping object
                let user = feeds[i].display;
                // Write to log
                if(!disable)
                    this.actionLog(user, "leave");
                console.log(" :: Remove feed: " + id + " - Name: " + user.username);
                delete users[user.id];

                // Delete from questions list
                for(let i = 0; i < quistions_queue.length; i++) {
                    if(quistions_queue[i].user.id === user.id) {
                        quistions_queue.splice(i, 1);
                        break
                    }
                }

                // Delete from qfeeds
                for(let i = 0; i < qfeeds.length; i++){
                    if(qfeeds[i].display.id === user.id) {
                        qfeeds.splice(i, 1);
                        break
                    }
                }

                // Remove from general feeds list
                feeds.splice(i, 1);

                // Fix feeds_queue if equal to last index
                if(feeds_queue >= feeds.length - 1) {
                    feeds_queue = feeds.length - 1;
                    this.setState({feeds_queue});
                }

                this.setState({feeds,users,quistions_queue}, () => {
                    // Send an unsubscribe request
                    let streams = [{ feed: id }];
                    this.unsubscribeFrom(streams, id);
                });
                break
            }
        }
    };

    fillProgram = (pre_feed, manual) => {
        let {round,mids,feeds,feeds_queue} = this.state;

        // Make sure there is no empty space in program
        if(feeds.length > 12 && manual === null) {
            Janus.log(" :: Auto Switch mids - ", mids);
            mids.forEach((mid,i) => {
                Janus.debug(" :: mids iteration - ", i, mid);
                if (mid && !mid.active) {
                    Janus.log(" :: Found empty slot in program! - ", mids[i]);
                    let feed =  feeds[feeds_queue];
                    feeds_queue++;
                    if(feeds_queue >= feeds.length) {
                        // End round here!
                        Janus.log(" -- ROUND END --");
                        feeds_queue = 0;
                        round++;
                        this.setState({feeds_queue,round});
                    } else {
                        this.setState({feeds_queue});
                    }
                    Janus.log(":: Switch program to: ", feed);
                    let streams = [{feed: feed.id, mid: "1"}];
                    this.subscribeTo(streams);
                }
            })
        // Slot in program changed manually
        } else if(manual !== null) {
            Janus.log(" :: Manual Switch mids - ", mids);
            for(let i=0; i<mids.length; i++) {
                let mid = mids[i];
                Janus.debug(" :: mids iteration - ", i, mid);
                if (mid && !mid.active) {
                    Janus.log(" :: Found empty slot in program! - ", mids[i]);
                    // If feed was in preview take him else take next in queue
                    let feed = pre_feed ? pre_feed : feeds[feeds_queue];
                    if(pre_feed) {
                        // Hide preview
                        this.setState({pre_feed: null});
                    } else {
                        this.nextInQueue();
                    }
                    this.setState({program: null});
                    Janus.log(":: Switch program to: ", feed);
                    let streams = [{feed: feed.id, mid: "1"}];
                    this.subscribeTo(streams);
                    break
                }
            }
        } else {
            Janus.log(":: Auto Switch was triggered but program is not full :: ");
        }
    };

    nextInQueue = () => {
        let {feeds_queue,feeds,round} = this.state;
        feeds_queue++;
        if(feeds_queue >= feeds.length) {
            // End round here!
            Janus.log(" -- ROUND END --");
            feeds_queue = 0;
            round++;
            this.setState({feeds_queue,round});
        } else {
            this.setState({feeds_queue});
        }
    };

    setProps = (props) => {
        this.setState({...props})
    };

    resetQueue = () => {
        if(this.state.feeds.length > 12) {
            console.log("-- Reset Queue --");
            this.setState({feeds_queue: 0});
            setTimeout(() => {
                this.col1.switchFour();
                this.col2.switchFour();
                this.col3.switchFour();
            }, 1000);
        }
    };

    sdiAction = (action, status, i, feed) => {
        //FIXME: Must be removed in production mode
        return;
        const { protocol, user, index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : null;
        let msg = { type: "sdi-"+action, status, room: 1234, col, i, feed};
        sendProtocolMessage(protocol, user, msg );
    };

    render() {

        const {user} = this.state;

        let login = (<LoginPage user={user} />);

        let content = (
            <Grid columns={2} padded>
                <Grid.Column width={12}>
                    <Grid columns={3}>
                        <Grid.Row>
                            <Grid.Column>
                                <ShidurGroups
                                    index={0} {...this.state}
                                    ref={col => {this.col1 = col;}}
                                    setProps={this.setProps}
                                    unsubscribeFrom={this.unsubscribeFrom}
                                    subscribeTo={this.subscribeTo}
                                    removeFeed={this.removeFeed} />
                            </Grid.Column>
                            <Grid.Column>
                                <ShidurGroups
                                    index={4} {...this.state}
                                    ref={col => {this.col2 = col;}}
                                    setProps={this.setProps}
                                    unsubscribeFrom={this.unsubscribeFrom}
                                    subscribeTo={this.subscribeTo}
                                    removeFeed={this.removeFeed} />
                            </Grid.Column>
                            <Grid.Column>
                                <ShidurGroups
                                    index={8} {...this.state}
                                    ref={col => {this.col3 = col;}}
                                    setProps={this.setProps}
                                    unsubscribeFrom={this.unsubscribeFrom}
                                    subscribeTo={this.subscribeTo}
                                    removeFeed={this.removeFeed} />
                            </Grid.Column>
                        </Grid.Row>
                        <ShidurToran
                            {...this.state}
                            ref={pre => {this.pre = pre;}}
                            resetQueue={this.resetQueue}
                            setProps={this.setProps}
                            nextInQueue={this.nextInQueue}
                            unsubscribeFrom={this.unsubscribeFrom}
                            subscribeTo={this.subscribeTo}
                            removeFeed={this.removeFeed} />
                    </Grid>
                </Grid.Column>
                <Grid.Column width={4}>
                    {/*<ShidurUsers*/}
                    {/*    ref={col => {this.col4 = col;}}*/}
                    {/*    setProps={this.setProps} />*/}
                </Grid.Column>
            </Grid>
        );

        return (
            <div>
                {user ? content : login}
            </div>
        );
    }
}

export default ShidurApp;