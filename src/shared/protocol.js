import {Janus} from "../lib/janus";
import {SERVICE_ROOM, PROTOCOL_ROOM, SDIOUT_ID, SHIDUR_ID, SNDMAN_ID, STORAN_ID} from "./consts";
import {getDateString} from "./tools";

const attachGxyProtocol = (protocol, user, service) => {
    let transaction = Janus.randomString(12);
    let register = {
        textroom: "join",
        transaction: transaction,
        room: service ? SERVICE_ROOM : PROTOCOL_ROOM,
        username: user.id || user.sub,
        display: user.display
    };
    protocol.data({
        text: JSON.stringify(register),
        error: (reason) => {
            alert(reason);
        }
    });
};

export const initGxyProtocol = (janus,user,callback,ondata,service) => {
    let protocol = null;
    janus.attach(
        {
            plugin: "janus.plugin.textroom",
            opaqueId: "gxy_protocol",
            success: (handle) => {
                protocol = handle;
                callback(protocol);
                Janus.log("Plugin attached! (" + protocol.getPlugin() + ", id=" + protocol.getId() + ")");
                // Setup the DataChannel
                let body = {"request": "setup"};
                Janus.debug("Sending message (" + JSON.stringify(body) + ")");
                protocol.send({"message": body});
            },
            error: (error) => {
                console.error("  -- Error attaching plugin...", error);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            onmessage: (msg, jsep) => {
                Janus.debug(" ::: Got a message :::");
                Janus.debug(msg);
                if (msg["error"] !== undefined && msg["error"] !== null) {
                    alert(msg["error"]);
                }
                if (jsep !== undefined && jsep !== null) {
                    // Answer
                    protocol.createAnswer(
                        {
                            jsep: jsep,
                            media: {audio: false, video: false, data: true},	// We only use datachannels
                            success: (jsep) => {
                                Janus.debug("Got SDP!");
                                Janus.debug(jsep);
                                let body = {"request": "ack"};
                                protocol.send({"message": body, "jsep": jsep});
                            },
                            error: (error) => {
                                Janus.error("WebRTC error:", error);
                                alert("WebRTC error... " + JSON.stringify(error));
                            }
                        });
                }
            },
            ondataopen: () => {
                Janus.log("The DataChannel is available!");
                attachGxyProtocol(protocol,user,service);
            },
            ondata: (data) => {
                Janus.debug("We got data from the DataChannel! " + data);
                onProtocolData(data,user,ondata);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification :::");
            }
        });
};

const onProtocolData = (data,user,ondata) => {
    Janus.debug(":: -- Protocol message from Data Channel: ",data);
    let json = JSON.parse(data);
    // var transaction = json["transaction"];
    // if (transactions[transaction]) {
    //     // Someone was waiting for this
    //     transactions[transaction](json);
    //     delete transactions[transaction];
    //     return;
    // }
    let what = json["textroom"];
    if (what === "message") {
        // Incoming message: public or private?
        let msg = json["text"];
        msg = msg.replace(new RegExp('<', 'g'), '&lt');
        msg = msg.replace(new RegExp('>', 'g'), '&gt');
        let from = json["from"];
        let dateString = getDateString(json["date"]);
        let whisper = json["whisper"];
        if (whisper === true) {
            // Private message
            Janus.log("-:: It's protocol private message: "+dateString+" : "+from+" : "+msg)
        } else {
            // Public message
            let message = JSON.parse(msg);
            message.time = dateString;
            ondata(message)
        }
    } else if (what === "success") {
        if(json.participants) {
            Janus.log("--- Got Protocol Users: ", json, user);
            let shidur = json.participants.find(c => c.username === SHIDUR_ID);
            let storan = json.participants.find(c => c.username === STORAN_ID);
            let sndman = json.participants.find(c => c.username === SNDMAN_ID);
            let sdiout = json.participants.find(c => c.username === SDIOUT_ID);

            if (shidur) {
                Janus.log(":: Support Online ::");
            } else {
                Janus.log(":: Support Offline ::");
            }

            if (storan && (user.id === SDIOUT_ID || user.id === SNDMAN_ID)) {
                Janus.log(":: Shidur " + (sndman ? "Online" : "Offline") + " ::");
                ondata({type: "event", shidur: storan.username === STORAN_ID})
            }

            if (sndman && user.id === STORAN_ID) {
                Janus.log(":: SoundMan " + (sndman ? "Online" : "Offline") + " ::");
                ondata({type: "event", sndman: sndman.username === SNDMAN_ID})
            }

            if (sdiout && user.id === STORAN_ID) {
                Janus.log(":: SdiOut " + (sdiout ? "Online" : "Offline") + "  ::");
                ondata({type: "event", sdiout: sdiout.username === SDIOUT_ID})
            }
        }
    } else if (what === "join") {
        // Somebody joined
        let username = json["username"];
        let display = json["display"];
        Janus.log("- Somebody joined - username: "+username+" : display: "+display);
        if (username === SHIDUR_ID) {
            Janus.log(":: Support Enter ::");
        }

        if (username === SNDMAN_ID && user.id === STORAN_ID) {
            Janus.log(":: SoundMan Enter ::");
            ondata({type: "event", sndman: true})
        }

        if (username === SDIOUT_ID && user.id === STORAN_ID) {
            Janus.log(":: SdiOut Enter ::");
            ondata({type: "event", sdiout: true})
        }

        if (username === user.id) {
            Janus.log(":: IT's me ::");
            ondata({type: "joined"})
        }
    } else if (what === "leave") {
        // Somebody left
        let username = json["username"];
        //var when = new Date();
        Janus.log("-:: Somebody left - username: "+username+" : Time: "+getDateString());
        ondata({type: "leave", id: username});

        if (username === SHIDUR_ID) {
            Janus.log(":: Support Left ::");
        }

        if (username === SNDMAN_ID && user.id === STORAN_ID) {
            Janus.log(":: SoundMan Left ::");
            ondata({type: "event", sndman: false})
        }

        if (username === SDIOUT_ID && user.id === STORAN_ID) {
            Janus.log(":: SdiOut Left ::");
            ondata({type: "event", sdiout: false})
        }
    } else if (what === "kicked") {
        // Somebody was kicked
        // var username = json["username"];
    } else if (what === "destroyed") {
        let room = json["room"];
        Janus.log("The room: "+room+" has been destroyed")
    } else if (what === "error") {
        let error = json["error"];
        let error_code = json["error_code"];
        Janus.error("Protocol error : " + error)
        ondata({type: "error", error, error_code})
    }
};

export const sendProtocolMessage = (protocol,user,msg,service) => {
    //let msg = {user, text: text};
    let message = {
        ack: false,
        textroom: "message",
        transaction: Janus.randomString(12),
        room: service ? SERVICE_ROOM : PROTOCOL_ROOM,
        text: JSON.stringify(msg),
    };
    // Note: messages are always acknowledged by default. This means that you'll
    // always receive a confirmation back that the message has been received by the
    // server and forwarded to the recipients. If you do not want this to happen,
    // just add an ack:false property to the message above, and server won't send
    // you a response (meaning you just have to hope it succeeded).
    protocol.data({
        text: JSON.stringify(message),
        error: (reason) => { alert(reason); },
        success: () => {
            Janus.log(":: Protocol Message sent ::");
        }
    });
};