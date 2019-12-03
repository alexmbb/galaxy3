import React, {Component, Fragment} from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Table} from "semantic-ui-react";
import './ShidurToran.scss';
import UsersHandle from "./UsersHandle";

class UsersToran extends Component {

    state = {
        index: 0,
        group: null,
    };

    componentDidMount() {
    };

    componentDidUpdate(prevProps) {
        if(this.props.group === null && prevProps.group) {
            this.users.exitVideoRoom(prevProps.group.room);
        }
    }

    selectGroup = (group, i) => {
        group.index = i;
        this.props.setProps({group});
        Janus.log(group);
        let room = group.room;
        this.users.initVideoRoom(room, "program");
    };

    disableRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_rooms} = this.props;
            let group = disabled_rooms.find(r => r.room === data.room);
            if(group) return;
            disabled_rooms.push(data);
            this.props.setProps({disabled_rooms});
        }
    };

    restoreRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_rooms} = this.props;
            for(let i = 0; i < disabled_rooms.length; i++){
                if(disabled_rooms[i].room === data.room) {
                    disabled_rooms.splice(i, 1);
                    this.props.setProps({disabled_rooms});
                }
            }
        }
    };

  render() {
      const {group,disabled_rooms,groups} = this.props;
      const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);

      let rooms_list = groups.map((data,i) => {
          const {room, num_users, description, questions} = data;
          return (
              <Table.Row positive={group && group.description === description}
                         className={group && group.room === room ? 'active' : 'no'}
                         key={room} onClick={() => this.selectGroup(data, i)}
                         onContextMenu={(e) => this.disableRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_users}</Table.Cell>
                  <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
              </Table.Row>
          )
      });

      let disabled_list = disabled_rooms.map((data,i) => {
          const {room, num_users, description, questions} = data;
          return (
              <Table.Row key={room} warning
                         onClick={() => this.selectGroup(data, i)}
                         onContextMenu={(e) => this.restoreRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_users}</Table.Cell>
                  <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
              </Table.Row>
          )
      });

      return (
          <Fragment>
              <Segment className="preview_conteiner" color='green' >
                  <div className="shidur_overlay"><span>{group ? group.description : ""}</span></div>
                  <UsersHandle ref={users => {this.users = users;}} {...this.props} />
              </Segment>
              <Segment textAlign='center' className="users_list" raised>
                  <Table selectable compact='very' basic structured className="admin_table" unstackable>
                      <Table.Body>
                          {rooms_list}
                      </Table.Body>
                  </Table>
              </Segment>
              <Segment textAlign='center' className="disabled_users">
                  <Table selectable compact='very' basic structured className="admin_table" unstackable>
                      <Table.Body>
                          {disabled_list}
                      </Table.Body>
                  </Table>
              </Segment>
          </Fragment>
      );
  }
}

export default UsersToran;