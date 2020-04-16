import React, { Component } from 'react';
import {client,getUser} from './UserManager';
import { Container,Message,Button,Dropdown,Image,Divider } from 'semantic-ui-react';
import logo from './logo.svg';

class LoginPage extends Component {

    state = {
        disabled: true,
        loading: true,
    };

    componentDidMount() {
        this.appLogin();
    };

    appLogin = () => {
        getUser(user => {
            if(user) {
                client.querySessionStatus().then(() => {
                    this.props.checkPermission(user);
                }).catch((error) => {
                    console.log("querySessionStatus: ", error);
                    alert("We detect wrong browser cookies settings");
                    client.signoutRedirect();
                });
            } else {
                client.signinRedirectCallback().then((user) => {
                    if(user.state) window.location = user.state;
                }).catch(() => {
                    client.signinSilent().then(user => {
                        if(user) this.appLogin();
                    }).catch((error) => {
                        console.log("SigninSilent error: ", error);
                        this.setState({disabled: false, loading: false});
                    });
                });
            }
        });
    };

    userLogin = () => {
        this.setState({disabled: true, loading: true});
        getUser(cb => {
            if(!cb) client.signinRedirect({state: window.location.href});
        });
    };

    render() {

        const {disabled, loading} = this.state;

        let login = (<div>
            <Button size='massive' primary onClick={this.userLogin} disabled={disabled} loading={loading}>Login</Button>
            <Button size='massive' primary onClick={() => window.open("https://galaxy.kli.one/guest","_self")} >Guest</Button>
        </div>);

        let profile = (
            <Dropdown inline text=''>
                <Dropdown.Menu>
                    <Dropdown.Item content='Profile:' disabled />
                    <Dropdown.Item text='My Account' onClick={() => window.open("https://accounts.kbb1.com/auth/realms/main/account", "_blank")} />
                    <Dropdown.Item text='Sign Out' onClick={() => client.signoutRedirect()} />
                </Dropdown.Menu>
            </Dropdown>);

        return (
            <Container textAlign='center' >
                <br />
                <Message size='massive'>
                    <Message.Header>
                        {this.props.user === null ? "Galaxy" : "Welcome, "+this.props.user.username}
                        {this.props.user === null ? "" : profile}
                    </Message.Header>
                    <p>The Group Today Is You Tomorrow</p>
                    {this.props.user === null ? login : this.props.enter}
                    <Divider horizontal>.</Divider>
                    {this.props.user === null ?
                        <Button color='violet' onClick={() => window.open("https://forms.gle/F6Lm2KMLUkU4hrmK8","_blank")} >Support</Button>
                        :
                        <div>
                            <Button primary onClick={() => window.open("http://ktuviot.kbb1.com/three_languages","_blank")} >Workshop Questions</Button>
                            <Button primary onClick={() => window.open("https://bb.kli.one/","_blank")} >BB KLI</Button>
                        </div>
                    }
                    <Image size='large' src={logo} centered />
                </Message>
            </Container>
        );
    }
}

export default LoginPage;
