import React, {Component} from 'react';
import {Button, Input, Message, Segment, Select} from "semantic-ui-react";
import {Janus} from "../../../lib/janus";
import {getDateString} from "../../../shared/tools";

const send_options = [
    {key: 'all', text: 'All', value: 'all'},
    {key: 'private', text: 'Private', value: 'private'},
];

class ChatBox extends Component {

    /*
        props:
            gateways: {},
            user: null,
            selected_user: null,
            selected_room: null,
            rooms:[],
            onChatRoomsInitialized: noop
    */

    state = {
        msg_type: "private",
        messages: [],
        visible: false,
        input_value: "",
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
        this.initGateways();
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
        const {gateways} = this.props;
        Object.values(gateways).forEach(gateway => {
            gateway.detachChatRoom();
        });
    };

    componentDidUpdate(prevProps) {
        if (prevProps.gateways !== this.props.gateways) {
            this.initGateways();
        }
    }

    initGateways = () => {
        const {gateways} = this.props;
        console.log("[Admin] [ChatBox] initGateways", gateways);

        Promise.all(Object.values(gateways).map(gateway => {
            if (!gateway.chatroom) {
                gateway.initChatRoom(data => this.onChatData(gateway, data))
                    .catch(err => {
                        console.error("[Admin] [ChatBox] gateway.initChatRoom error", gateway.name, err);
                    });
            }
        }))
            .then(() => {
                if (!!this.props.onChatRoomsInitialized) {
                    this.props.onChatRoomsInitialized();
                }
            });
    };

    onKeyPressed = (e) => {
        if (e.code === "Enter")
            this.sendPrivateMessage();
    };

    onChatData = (gateway, data) => {
        const json = JSON.parse(data);
        const what = json["textroom"];
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
                let message = JSON.parse(msg);
                message.user.username = message.user.display;
                message.time = dateString;
                console.log("[Admin] [ChatBox] private message", gateway.name, from, message);
                let {messages} = this.state;
                messages.push(message);
                this.setState({messages});
                this.scrollToBottom();
            } else {
                console.warn("[Admin] [ChatBox] unexpected public chat message", json);
            }
        } else if (what === "join") {
            gateway.log("[chatroom] Somebody joined", json["username"], json["display"]);
        } else if (what === "leave") {
            gateway.log("[chatroom] Somebody left", json["username"], getDateString());
        } else if (what === "kicked") {
            gateway.log("[chatroom] Somebody was kicked", json["username"], getDateString());
        } else if (what === "destroyed") {
            gateway.log("[chatroom] room destroyed", json["room"]);
        }
    };

    sendPrivateMessage = () => {
        const {user, selected_room, selected_user, gateways} = this.props;
        const {input_value} = this.state;
        if (!selected_user) {
            alert("Choose user");
            return;
        }

        const gateway = gateways[selected_user.janus];
        const msg = {user, text: input_value};
        gateway.data("chatroom", gateway.chatroom, {
            ack: false,
            textroom: "message",
            transaction: Janus.randomString(12),
            room: selected_room,
            to: selected_user.id,
            text: JSON.stringify(msg),
        })
            .then(() => {
                const {messages} = this.state;
                msg.time = getDateString();
                msg.to = selected_user.display;
                messages.push(msg);
                this.setState({messages, input_value: ""}, this.scrollToBottom);
            })
            .catch(alert);
    };

    sendBroadcastMessage = () => {
        const {user, selected_room, rooms, gateways} = this.props;
        const {input_value, messages} = this.state;

        const room_data = rooms.find(x => x.room === selected_room);
        if (!room_data) {
            console.warn("[Admin] [ChatBox] sendBroadcastMessage. no room data in state", selected_room);
            alert("No room data in state: " + selected_room);
            return;
        }

        const gateway = gateways[room_data.janus];
        const msg = {type: "chat-broadcast", room: selected_room, user, text: input_value};
        gateway.sendProtocolMessage(msg)
            .then(() => {
                msg.time = getDateString();
                msg.to = "all";
                messages.push(msg);
                this.setState({messages, input_value: "", msg_type: "private"}, this.scrollToBottom);
            })
            .catch(alert);
    };

    sendMessage = () => {
        const {msg_type} = this.state;
        msg_type === "private" ? this.sendPrivateMessage() : this.sendBroadcastMessage();
    };

    scrollToBottom = () => {
        this.refs.end.scrollIntoView({behavior: 'smooth'})
    };

    handleInputChange = (e, data) => {
        this.setState({input_value: data.value});
    };

    render() {
        const {messages, msg_type, input_value} = this.state;

        const list_msgs = messages.map((msg, i) => {
            const {user, time, text, to} = msg;
            return (
                <div key={i}><p>
                    <i style={{color: 'grey'}}>{time}</i> -
                    <b style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.username}</b>
                    {to ? <b style={{color: 'blue'}}>-> {to} :</b> : ""}
                </p>{text}</div>
            );
        });

        return (
            <Segment className='chat_segment'>
                <Message className='messages_list'>
                    {list_msgs}
                    <div ref='end'/>
                </Message>

                <Input fluid type='text' placeholder='Type your message' action value={input_value}
                       onChange={this.handleInputChange}>
                    <input/>
                    <Select options={send_options}
                            value={msg_type}
                            error={msg_type === "all"}
                            onChange={(e, {value}) => this.setState({msg_type: value})}/>
                    <Button positive negative={msg_type === "all"} onClick={this.sendMessage}>Send</Button>
                </Input>
            </Segment>
        );
    }
}

export default ChatBox;
