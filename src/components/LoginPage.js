import React, { Component } from 'react';
import {client,getUser} from './UserManager';
import {Container, Message, Button, Dropdown, Image, Divider, Select, Menu, Segment, Grid, Header} from 'semantic-ui-react';
import logo from './logo.svg';
import bblogo from './bblogo.png';
import {mapNameToLanguage, setLanguage} from "../i18n/i18n";
import {withTranslation} from "react-i18next";

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
        const { t, i18n } = this.props;
        const {disabled, loading} = this.state;

        let profile = (
            <Dropdown inline text=''>
                <Dropdown.Menu>
                    <Dropdown.Item content='Profile:' disabled />
                    <Dropdown.Item text='My Account' onClick={() => window.open("https://accounts.kbb1.com/auth/realms/main/account", "_blank")} />
                    <Dropdown.Item text='Sign Out' onClick={() => client.signoutRedirect()} />
                </Dropdown.Menu>
            </Dropdown>);

        return (
            <Container fluid >
                <Menu secondary>
                    <Menu.Item>
                        <Image src={bblogo} />
                    </Menu.Item>

                    <Menu.Menu position='right'>
                        <Menu.Item>
                            <Select compact
                                    value={i18n.language}
                                    options={mapNameToLanguage(i18n.language)}
                                    onChange={(e, { value }) => {setLanguage(value)}} />
                        </Menu.Item>
                        <Menu.Item>
                            <Button size='massive' color='violet'
                                    onClick={() => window.open("https://forms.gle/F6Lm2KMLUkU4hrmK8","_blank")}>
                                {t('loginPage.support')}
                            </Button>
                        </Menu.Item>
                    </Menu.Menu>
                </Menu>
            <Container textAlign='center' >
                <br />
                <Message size='massive'>
                    <Message.Header>
                        {this.props.user === null ? t('loginPage.galaxy') : "Welcome, "+this.props.user.username}
                        {this.props.user === null ? "" : profile}
                    </Message.Header>
                    <p>{t('loginPage.slogan')}</p>
                    {this.props.user === null ? "" : this.props.enter}

                    {this.props.user === null ?
                        <Segment basic>
                            <Grid columns={2} stackable textAlign='center'>
                                <Divider vertical />

                                <Grid.Row verticalAlign='middle'>
                                    <Grid.Column>
                                        <Header>
                                            {t('loginPage.regUsers')}
                                        </Header>
                                        <br /><br />
                                        <Button size='massive' primary onClick={this.userLogin} disabled={disabled} loading={loading}>{t('loginPage.login')}</Button>
                                    </Grid.Column>

                                    <Grid.Column>
                                        <Header>
                                            {t('loginPage.newUsers')}
                                        </Header>
                                        <p>{t('loginPage.guestMessage')}</p>
                                        <br />
                                        <Button size='massive' primary onClick={() => window.open("https://galaxy.kli.one/guest","_self")} >{t('loginPage.guest')}</Button>
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                        :
                        <div>
                            <Image size='large' src={logo} centered />
                            <Button primary onClick={() => window.open("http://ktuviot.kbb1.com/three_languages","_blank")} >Workshop Questions</Button>
                            <Button primary onClick={() => window.open("https://bb.kli.one/","_blank")} >BB KLI</Button>
                        </div>
                    }
                </Message>
            </Container>
            </Container>
        );
    }
}

export default withTranslation()(LoginPage);
