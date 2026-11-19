/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {startFirework} from './src/sdk';
import {CART_SHEET} from './src/cart/sheet';
import {CartSheet} from './src/screens/CartSheet';

// Before the first render: hydration must be in place before any Firework feed loads.
startFirework();

AppRegistry.registerComponent(appName, () => App);
// The "Added to cart" popup over Firework's player, opened with navigator.pushRNContainer (src/cart/sheet.ts).
AppRegistry.registerComponent(CART_SHEET, () => CartSheet);
