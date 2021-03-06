import React, { Component } from 'react';
import {Segment, Icon, Button} from "semantic-ui-react";
import './UsersQuad.scss'
import UsersHandle from "./UsersHandle";
import api from '../../shared/Api';
import {getStore, setStore} from "../../shared/store";

class UsersQuad extends Component {

    state = {
        question: false,
        col: null,
        vquad: [null,null,null,null],
    };

    componentDidMount() {
        let { index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : index === 12 ? 4 : null;
        this.setState({col});
    };

    componentDidUpdate(prevProps) {
        let {groups,index} = this.props;
        let {vquad,col} = this.state;
        if(groups.length > prevProps.groups.length) {
            let res = groups.filter(o => !prevProps.groups.some(v => v.room === o.room))[0];
            console.log("[Shidur] :: Group enter in queue: ", res);
            if(vquad[0] === null && groups.length > index+4) {
                setTimeout(() => {
                    this.switchFour();
                }, col*1000);
            }
        } else if(groups.length < prevProps.groups.length) {
            let res = prevProps.groups.filter(o => !groups.some(v => v.room === o.room))[0];
            console.log("[Shidur] :: Group exit from queue: ", res);
            for(let i=0; i<4; i++) {
                if(vquad[i] && vquad[i].room === res.room) {
                    // Check question state
                    let store = getStore();
                    let {qst,col,group} = store;
                    if(qst && group.room === res.room) {
                        this.toFourGroup(i,group,() => {},true);
                        setStore({qst: false,col,group});
                    }
                    // FIXME: Does we need send leave room request?
                    this.switchProgram(i, true);
                    break;
                }
            }
        }
    };

    quadCheckDup = () => {
        let {group,groups,groups_queue} = this.props;
        let {vquad} = this.state;
        let dup = false;
        let g = group || groups[groups_queue];
        for (let i=0; i<4; i++) {
            if(vquad[i] && g && vquad[i].room === g.room) {
                dup = true;
                break;
            }
        }
        return dup;
    };

    quadGroup = (queue) => {
        let {groups} = this.props;
        let group = groups[queue];
        delete group.users;
        group.queue = queue;
        return group;
    };

    switchProgram = (i, leave) => {
        let {group,groups,groups_queue,round} = this.props;
        let {vquad,col} = this.state;

        if(leave)
            groups_queue--;

        if(this.quadCheckDup())
            return;

        if(group) {
            // From preview
            delete group.users;
            vquad[i] = group;
            this.props.setProps({group: null});
        } else {
            // Next in queue
            if(groups_queue >= groups.length) {
                // End round here!
                console.log("[Shidur] -- ROUND END --");
                groups_queue = 0;
                round++;
            }
            vquad[i] = groups.length < 4 ? null : this.quadGroup(groups_queue);
            groups_queue++;
            this.props.setProps({groups_queue,round});
        }

        this.setState({vquad});
        api.updateQuad(col, {vquad})
            .catch(err => console.error("[Shidur] error updating quad state", col, err))
    };

    switchFour = () => {
        let {groups_queue,groups,round} = this.props;
        let {vquad,col} = this.state;

        for(let i=0; i<4; i++) {

            // Don't switch if nobody in queue
            if(i === groups.length) {
                console.log("[Shidur] Queue is END");
                break;
            }

            if(groups_queue >= groups.length) {
                // End round here!
                console.log("[Shidur] -- ROUND END --");
                groups_queue = 0;
                round++;
                this.props.setProps({groups_queue,round});
            }

            vquad[i] = this.quadGroup(groups_queue);
            groups_queue++;
            this.props.setProps({groups_queue});
        }
        this.setState({vquad});

        // Disable queue until program full
        if(groups.length < 4) {
            this.props.setProps({groups_queue: 0});
        }

        api.updateQuad(col, {vquad})
            .catch(err => console.error("[Shidur] error updating quad state", col, err))
    };

    setPreset = () => {
        let {presets} = this.props;
        let {vquad,col} = this.state;

        if(presets[col].length === 0) return;

        for(let i=0; i<presets[col].length; i++) {
            vquad[i] = presets[col][i];
        }
        this.setState({vquad});

        api.updateQuad(col, {vquad})
            .catch(err => console.error("[Shidur] error updating quad state", col, err))
    };

    sdiAction = (action, status, i, group, qst) => {
        const {gateways} = this.props;
        const {col} = this.state;
        let msg = {type: "sdi-"+action, status, room: null, col, i, group, qst};
        gateways["gxy3"].sendServiceMessage(msg);
    };

    checkFullScreen = () => {
        let {fullscr,full_feed,vquad,question} = this.state;
        if(fullscr) {
            console.log("[Shidur] :: Group: " + full_feed + " , sending sdi-action...");
            this.sdiAction("fullscr_group" , true, full_feed, vquad[full_feed], question);
        }
    };

    switchFullScreen = (i,g,q) => {
        if(!g) return;
        let {fullscr,full_feed,question} = this.state;

        if(question) return;

        if(fullscr && full_feed === i) {
            this.toFourGroup(i,g,() => {},q);
        } else if(fullscr) {
            this.toFourGroup(i,g, () => {
                this.toFullGroup(i,g,q);
            });
        } else {
            this.toFullGroup(i,g,q);
        }
    };

    switchQuestion = (i,g,q) => {
        if(!g) return;
        let {fullscr,full_feed,question,col} = this.state;

        if(fullscr && !question) return;

        let store = getStore();
        if(store.qst && store.col !== col) return;

        if(fullscr && full_feed === i) {
            this.toFourGroup(i,g,() => {},q);
            setStore({qst: false,col,group: g});
        } else if(fullscr) {
            return
            // this.toFourGroup(i,g, () => {
            //     this.toFullGroup(i,g,q);
            //     setStore({qst: true,col,group: g});
            // });
        } else {
            this.toFullGroup(i,g,q);
            setStore({qst: true,col,group: g});
        }
    };

    toFullGroup = (i,g,q) => {
        console.log("[Shidur]:: Make Full Screen Group: ",g);
        this.setState({fullscr: true, full_feed: i, question: q});
        this.sdiAction("fullscr_group" , true, i, g, q);
    };

    toFourGroup = (i,g,cb,q) => {
        console.log("[Shidur]:: Back to four: ");
        this.sdiAction("fullscr_group" , false, i, g, q);
        this.setState({fullscr: false, full_feed: null, question: false}, () => {
            cb();
        });
    };

  render() {
      const {full_feed,fullscr,col,vquad,question} = this.state;
      const {groups,group,rooms,next_button,presets} = this.props;
      const q = (<div className="question">
          <svg viewBox="0 0 50 50">
              <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
          </svg>
      </div>);

      let program = vquad.map((g,i) => {
          if (groups.length === 0) return false;
          let qst = rooms ? rooms.filter(q => q && g && q.room === g.room && q.questions).length > 0 : false;
          let qf = fullscr && full_feed === i && question;
          let ff = fullscr && full_feed === i && !question;
          let name = g ? g.description : "";
          return (
              <div key={"pr" + i} className={qf ? "video_full" : ff ? "video_qst" : "video_box"} >
                  <div className='click-panel' onClick={() => this.switchQuestion(i,g,true)} >
                  <div className='video_title' >{name}</div>
                  {qst ? q : ""}
                  <UsersHandle key={"q"+i} g={g} index={i} {...this.props} />
                  </div>
                  {!question ?
                  <Button className='fullscr_button'
                          size='mini'
                          color='blue'
                          icon='expand arrows alternate'
                          onClick={() => this.switchFullScreen(i,g,false)} /> : ""}
                  {fullscr && full_feed === i ? "" :
                      <Button className='next_button'
                              disabled={groups.length < 5 || next_button}
                              size='mini'
                              color='green'
                              icon={group ? 'arrow up' : 'share'}
                              onClick={() => this.switchProgram(i, false)} />}
              </div>
          );
      });

      return (
          <Segment className="group_conteiner">
              <Segment attached className="program_segment" color='red'>
                  <div className="video_grid">
                      {program}
                  </div>
              </Segment>
              <Button.Group attached='bottom' size='mini'>
                  <Button className='preset_button'
                          disabled={presets.length === 0}
                          color='teal'
                          onClick={this.setPreset} >
                      {col}
                  </Button>
                  <Button className='fours_button'
                          disabled={groups.length < 10 || fullscr}
                          color='brown'
                          onClick={this.switchFour}>
                      <Icon name='share' />
                      <Icon name='th large' />
                      <Icon name='share' />
                  </Button>
              </Button.Group>
          </Segment>
    );
  }
}

export default UsersQuad;
