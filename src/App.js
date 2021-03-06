import React, { Component } from 'react';
import 'semantic-ui-css/semantic.min.css';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';

import './i18n/i18n';
// import GalaxyApp from "./apps/GalaxyApp";
// import MobileClient from "./apps/MobileApp/MobileClient";
import VirtualClient from "./apps/VirtualApp/VirtualClient";
// import VirtualStreaming from "./apps/VirtualApp/VirtualStreaming";
// import GalaxyStream from "./apps/StreamApp/GalaxyStream";
// import AdminRoot from "./apps/AdminApp/AdminRoot";
// import ShidurApp from "./apps/ShidurApp/ShidurApp";
// import SndmanApp from "./apps/SndmanApp/SndmanApp";
// import AudioOutApp from "./apps/AudioOutApp/AudioOutApp";
// import SDIOutApp from "./apps/SDIOutApp/SDIOutApp";

class App extends Component {
  render() {
    return (
      <I18nextProvider i18n={i18n}>
        {/*<GalaxyApp />*/}
        {/*<MobileClient/>*/}
        <VirtualClient />
        {/* <VirtualStreaming/>*/}
        {/* <GalaxyStream/>*/}
        {/*<AdminRoot />*/}
        {/*<ShidurApp/>*/}
        {/*<SndmanApp/>*/}
        {/*<AudioOutApp />*/}
        {/*<SDIOutApp />*/}
      </I18nextProvider>
    );
  }
}

export default App;
