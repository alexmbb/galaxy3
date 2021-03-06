import React, {Component} from 'react';
import {Grid, Label, Message, Segment, Table, Button, Dropdown, Popup} from "semantic-ui-react";
import './ShidurToran.scss';
import UsersPreview from "./UsersPreview";


class ShidurToran extends Component {

    state = {
        delay: false,
        index: 0,
        group: null,
        open: false,
        sorted_feeds: [],
        pg: null,
    };

    componentDidUpdate(prevProps) {
        let {group} = this.props;
        if(prevProps.group !== group && group === null) {
            this.setState({open: false});
        }
    }

    selectGroup = (group, i) => {
        if(this.state.delay) return;
        console.log(group, i);
        this.setState({pg: group, open: true});
        group.queue = i;
        this.props.setProps({group});
    };

    closePopup = ({disable=false}={}) => {
        if (disable) {
            this.disableRoom(this.props.group);
        }
        this.props.setProps({group: null});
    };

    handleDisableRoom = (e, data) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            this.disableRoom(data);
        }
    };

    shidurMode = (mode) => {
        this.props.setProps({mode});
    };

    disableRoom = (data) => {
        if(this.state.delay) return;
        let {disabled_rooms} = this.props;
        let group = disabled_rooms.find(r => r.room === data.room);
        if (group) return;
        disabled_rooms.push(data);
        this.props.setProps({disabled_rooms});
        this.setDelay();
    };

    restoreRoom = (e, data, i) => {
        if(this.state.delay) return;
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_rooms} = this.props;
            for(let i = 0; i < disabled_rooms.length; i++){
                if(disabled_rooms[i].room === data.room) {
                    disabled_rooms.splice(i, 1);
                    this.props.setProps({disabled_rooms});
                    this.setDelay();
                }
            }
        }
    };

    sortGroups = () => {
        let sorted_feeds = this.props.groups.slice();
        sorted_feeds.sort((a, b) => {
            if (a.description > b.description) return 1;
            if (a.description < b.description) return -1;
            return 0;
        });
        this.setState({sorted_feeds});
    };

    savePreset = (p) => {
        let {presets,group} = this.props;

        // Take to preset from preview
        if(!group) return

        // First group to preset
        if(presets[p].length === 0) {
            delete group.users;
            presets[p][0] = group;
            this.props.setProps({presets});
            return
        }

        //Don't allow group be twice in presets
        for(let i=0; i<presets[p].length; i++) {
            //remove from presets
            if(presets[p][i].room === group.room) {
                presets[p].splice(i, 1);
                this.props.setProps({presets});
                return
            }
        }

        // Presets is full
        if(presets[p].length === 4)
            return;

        //Add to presets
        delete group.users;
        presets[p].push(group);
        this.props.setProps({presets});

        console.log(presets)
    };

    previewQuestion = () => {
        let {questions} = this.props;
        if(questions.length > 0)
            this.selectGroup(questions[0], null);
    };

    sdiAction = (action, status, i, feed) => {
        const { gateways, index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : index === 12 ? 4 : null;
        let msg = { type: "sdi-"+action, status, room: null, col, i, feed};
        gateways["gxy3"].sendServiceMessage(msg);
    };

    setDelay = () => {
        this.setState({delay: true});
        setTimeout(() => {
            this.setState({delay: false});
        }, 3000);
    };

    render() {

        const {group,disabled_rooms,groups,groups_queue,questions,presets,users,sdiout,sndman,mode} = this.props;
        const {open,delay} = this.state;
        const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);
        const next_group = groups[groups_queue] ? groups[groups_queue].description : groups[0] ? groups[0].description : "";
        const ng = groups[groups_queue] || null;

        let rooms_list = groups.map((data,i) => {
            const {room, num_users, description, questions} = data;
            const next = data.description === next_group;
            const active = group && group.room === room;
            //const pr = presets.find(pst => pst.room === room);
            const pr = false
            const p = pr ? (<Label size='mini' color='teal' >4</Label>) : "";
            return (
                <Table.Row positive={group && group.description === description}
                           className={active ? 'active' : next ? 'warning' : 'no'}
                           key={room}
                           onClick={() => this.selectGroup(data, i)}
                           onContextMenu={(e) => this.handleDisableRoom(e, data)} >
                    <Table.Cell width={5}>{description}</Table.Cell>
                    <Table.Cell width={1}>{p}</Table.Cell>
                    <Table.Cell width={1}>{num_users}</Table.Cell>
                    <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
                </Table.Row>
            )
        });

        let disabled_list = disabled_rooms.map((data,i) => {
            const {room, num_users, description, questions} = data;
            return (
                <Table.Row key={room} error
                           onClick={() => this.selectGroup(data, i)}
                           onContextMenu={(e) => this.restoreRoom(e, data, i)} >
                    <Table.Cell width={5}>{description}</Table.Cell>
                    <Table.Cell width={1}>{num_users}</Table.Cell>
                    <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
                </Table.Row>
            )
        });

        let group_options = this.state.sorted_feeds.map((feed,i) => {
            const display = feed.description;
            return ({ key: i, value: feed, text: display })
        });

        let pst_buttons = Object.keys(presets).map(p => {
            let preset = presets[p].map(data => {
                const {room,description} = data;
                return (<p key={room}>{description}</p>)
            });
            return (<Popup on='hover' trigger={<Button color='teal' content={p} onClick={() => this.savePreset(p)} />} content={preset} />)
        })


        return (
            <Grid.Row>
                <Grid.Column>
                    <Segment className="preview_conteiner">
                        {ng ?
                        <Segment className="group_segment" color='blue'>
                                <div className="shidur_overlay"><span>{ng.description}</span></div>
                                <UsersPreview pg={ng} {...this.props} next />
                        </Segment>
                            : ""}
                    </Segment>
                    <Message attached className='info-panel' color='grey'>
                        {/*{action_log}*/}
                        <div ref='end' />
                    </Message>
                    <Button.Group attached='bottom' >
                        <Button
                            color={sndman ? "green" : "red"}
                            disabled={!sndman}
                            onClick={() => this.sdiAction("restart_sndman", false, 1, null)}>
                            SndMan</Button>
                        <Button
                            color={sdiout ? "green" : "red"}
                            disabled={!sdiout}
                            onClick={() => this.sdiAction("restart_sdiout", false, 1, null)}>
                            SdiOut</Button>
                    </Button.Group>
                </Grid.Column>
                <Grid.Column>
                    <Segment attached textAlign='center' >
                        <Label attached='top right' color='green' >
                            Users: {Object.keys(users).length}
                        </Label>
                        <Dropdown className='select_group'
                                  placeholder='Search..'
                                  fluid
                                  search
                                  selection
                                  options={group_options}
                                  onClick={this.sortGroups}
                                  onChange={(e,{value}) => this.selectGroup(value)} />
                        <Label attached='top left' color='blue'>
                            Groups: {groups.length}
                        </Label>
                    </Segment>
                    <Button.Group attached='bottom' size='mini' >
                        {pst_buttons}
                    </Button.Group>
                    <Segment textAlign='center' className="group_list" raised disabled={delay} >
                        <Table selectable compact='very' basic structured className="admin_table" unstackable>
                            <Table.Body>
                                {rooms_list}
                            </Table.Body>
                        </Table>
                    </Segment>
                    <Segment textAlign='center' >
                        <Button.Group attached='bottom' size='mini' >
                            <Button color={questions.length > 0 ? 'red' : 'grey'} onClick={this.previewQuestion} >Questions: {questions.length}</Button>
                        </Button.Group>
                    </Segment>
                </Grid.Column>
                <Grid.Column>
                    <Segment className="preview_conteiner">
                        {open ? <Segment className="group_segment" color='green'>
                                <div className="shidur_overlay"><span>{group ? group.description : ""}</span></div>
                                <UsersPreview pg={this.state.pg} {...this.props} closePopup={this.closePopup} />
                                </Segment> : ""}
                    </Segment>
                </Grid.Column>
                <Grid.Column>
                    <Button.Group attached='top' size='mini' >
                        <Button disabled={mode === "gvarim"} color='teal' content='Gvarim' onClick={() => this.shidurMode("gvarim")} />
                        <Button disabled={mode === "nashim"} color='teal' content='Nashim' onClick={() => this.shidurMode("nashim")} />
                        <Button disabled={mode === "beyahad" || mode === ""} color='teal' content='Beyahad' onClick={() => this.shidurMode("beyahad")} />
                    </Button.Group>
                    <Segment attached textAlign='center' className="disabled_groups">
                        <Table selectable compact='very' basic structured className="admin_table" unstackable>
                            <Table.Body>
                                {disabled_list}
                            </Table.Body>
                        </Table>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        );
    }
}

export default ShidurToran;
