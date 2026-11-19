/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {startFirework} from './src/sdk';

// Before the first render: hydration must be in place before any Firework feed loads.
startFirework();

AppRegistry.registerComponent(appName, () => App);
