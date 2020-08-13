import React, {Component, Fragment} from 'react';
import {Janus} from "../../lib/janus";
import {Segment} from "semantic-ui-react";
import './AudioOutApp.css';
import './UsersAudioOut.css'
import UsersHandleAudioOut from "./UsersHandleAudioOut";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import {AUDIOOUT_ID} from "../../shared/consts"
import {GuaranteeDeliveryManager} from '../../shared/GuaranteeDelivery';


class AudioOutApp extends Component {

    state = {
        audio: false,
        group: null,
        room: null,
        user: {
            session: 0,
            handle: 0,
            role: "audioout",
            display: "audioout",
            id: AUDIOOUT_ID,
            name: "audioout"
        },
        gateways: {},
        gatewaysInitialized: false,
        appInitError: null,
        gdm: new GuaranteeDeliveryManager(AUDIOOUT_ID),
    };

    componentDidMount() {
        this.initApp();
    };

    componentWillUnmount() {
        Object.values(this.state.gateways).forEach(x => x.destroy());
    };

    initApp = () => {
        const {user} = this.state;
        api.setBasicAuth(API_BACKEND_USERNAME, API_BACKEND_PASSWORD);

        api.fetchConfig()
            .then(data => GxyJanus.setGlobalConfig(data))
            .then(() => this.initGateways(user))
            .catch(err => {
                console.error("[AudioOut] error initializing app", err);
                this.setState({appInitError: err});
            });
    }

    initGateways = (user) => {
        const gateways = GxyJanus.makeGateways("rooms");
        this.setState({gateways});

        return Promise.all(Object.values(gateways).map(gateway => (this.initGateway(user, gateway))))
            .then(() => {
                console.log("[AudioOut] gateways initialization complete");
                this.setState({gatewaysInitialized: true});
            });
    }

    initGateway = (user, gateway) => {
        console.log("[AudioOut] initializing gateway", gateway.name);

        gateway.addEventListener("reinit", () => {
                this.postInitGateway(user, gateway)
                    .catch(err => {
                        console.error("[AudioOut] postInitGateway error after reinit. Reloading", gateway.name, err);
                        window.location.reload();
                    });
            }
        );

        gateway.addEventListener("reinit_failure", (e) => {
            if (e.detail > 10) {
                console.error("[AudioOut] too many reinit_failure. Reloading", gateway.name, e);
                window.location.reload();
            }
        });

        return gateway.init()
            .then(() => this.postInitGateway(user, gateway));
    }

    postInitGateway = (user, gateway) => {
        console.log("[AudioOut] initializing gateway", gateway.name);

        if (gateway.name === "gxy3") {
            return gateway.initServiceProtocol(user, data => this.onServiceData(gateway, data, user))
        } else {
            return Promise.resolve();
        }
    };

    onServiceData = (gateway, data, user) => {
        const { gdm } = this.state;
        if (gdm.checkAck(data)) {
          // Ack received, do nothing.
          return;
        }
        gdm.accept(data, (msg) => gateway.sendServiceMessage(msg)).then((data) => {
          if (data.type === "error" && data.error_code === 420) {
              console.error("[AudioOut] service error message (reloading in 10 seconds)", data.error);
              setTimeout(() => {
                  this.initGateway(user, gateway);
              }, 10000);
          }

          const {room, group, status, qst} = data;

        if (data.type === "sdi-fullscr_group" && status && qst) {
            this.setState({group, room});
        } else if (data.type === "sdi-fullscr_group" && !status && qst) {
            this.setState({group: null, room: null});
        } else if (data.type === "sdi-restart_sdiout") {
            window.location.reload();
        } else if (data.type === "audio-out") {
            this.setState({audio: status});
        } else if (data.type === "event") {
            delete data.type;
            this.setState({...data});
        }
        }).catch((error) => {
            console.error(`Failed receiving ${data}: ${error}`);
        });
    };

    setProps = (props) => {
        this.setState({...props})
    };

    render() {
        const {gateways, group, appInitError, gatewaysInitialized, audio} = this.state;

        if (appInitError) {
            return (
                <Fragment>
                    <h1>Error Initializing Application</h1>
                    {`${appInitError}`}
                </Fragment>
            );
        }

        if (!gatewaysInitialized) {
            return "Initializing WebRTC gateways...";
        }

        const name = group && group.description;

        return (
            <Segment className="preview_sdi">
                <div className="usersvideo_grid">
                    <div className="video_full">
                        <div className="title">{name}</div>
                        <UsersHandleAudioOut g={group} gateways={gateways} audio={audio} setProps={this.setProps}/>
                    </div>
                </div>
            </Segment>
        );
    }
}

export default AudioOutApp;
