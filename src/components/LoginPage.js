import React, { Component,Fragment } from 'react';
import {client,getUser} from './UserManager';
import {Container, Message, Button, Dropdown, Image, Divider, Select, Menu, Segment, Grid, Header} from 'semantic-ui-react';
import logo from './logo.svg';
import bblogo from './bblogo.png';
import {mapNameToLanguage, setLanguage} from "../i18n/i18n";
import {withTranslation} from "react-i18next";
import {reportToSentry} from "../shared/tools";

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
                    this.setState({loading: false});
                    this.props.checkPermission(user);
                }).catch((error) => {
                    console.log("querySessionStatus: ", error);
                    reportToSentry("querySessionStatus: " + error,{source: "login"}, user, "warning");
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
        const rtl = i18n.language === "he" ? "rtl" : "";
        let profile = (
            <Dropdown inline text=''>
                <Dropdown.Menu>
                    <Dropdown.Item content='Profile:' disabled />
                    <Dropdown.Item text='My Account' onClick={() => window.open("https://accounts.kbb1.com/auth/realms/main/account", "_blank")} />
                    <Dropdown.Item text='Sign Out' onClick={() => client.signoutRedirect()} />
                </Dropdown.Menu>
            </Dropdown>);

        let login = (
            <Container textAlign='center' >
                <br /><br /><br /><br /><br /><br /><br />
                <Message size='massive'>
                    <Message.Header>{t('loginPage.galaxy')}</Message.Header>
                    <p>{t('loginPage.slogan')}</p>
                    <Button size='massive' primary disabled={disabled} loading={loading}>{t('loginPage.login')}</Button>
                    {/*<Image size='large' src={logo} centered />*/}
                </Message>
            </Container>
        );

        let main = (
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
                <Container textAlign='center' style={{direction: rtl}} >
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

                                    <Grid.Row verticalAlign='bottom'>
                                        <Grid.Column>
                                            <Header size='huge' >{t('loginPage.regUsers')}</Header>
                                            {/*<p style={{fontSize: "1.3em", opacity: '0.0' }}>You can either login and using the system as authorize user</p>*/}
                                            <br />
                                            <Button size='massive' primary onClick={this.userLogin} disabled={disabled} loading={loading}>{t('loginPage.login')}</Button>
                                        </Grid.Column>
                                        <Grid.Column>
                                            <Header size='huge'>{t('loginPage.newUsers')}</Header>
                                            {/*<p style={{fontSize: "1.3em"}}>{t('loginPage.guestMessage1')} <a href='#' onClick={this.userLogin}>{t('loginPage.register')}</a> {t('loginPage.guestMessage2')}</p>*/}
                                            <br />
                                            <Button size='massive' primary onClick={this.userLogin} >{t('loginPage.register')}</Button>
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

        return (
            <Fragment>
                {loading ? login : main}
            </Fragment>
        );
    }
}

export default withTranslation()(LoginPage);
