import { registerRootComponent } from 'expo';
import { enableScreens } from 'react-native-screens';

import App from './App';

// react-native-screens defaults to disabled on web (only auto-enables on
// iOS/Android/Windows). Without it, @react-navigation/bottom-tabs falls back
// to a plain absolutely-positioned View for inactive tab screens with no
// display:none toggling, so switching tabs briefly shows the previous
// screen's content bleeding through the new one's transparent regions.
enableScreens();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
