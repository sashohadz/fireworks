/**
 * Firework SDK start-up. The native side initialises the SDK in MainApplication.kt; JavaScript only marks that init
 * was called (FireworkSDK.init() must not be called here). The result is kept so the app can say when the App ID is
 * wrong instead of showing empty feeds.
 */
import FireworkSDK from 'react-native-firework-sdk';
import { installCart } from './cart/install';
import { installHydration } from './shopping/install';

export type InitState = { status: 'starting' } | { status: 'ready' } | { status: 'failed'; reason: string };

let state: InitState = { status: 'starting' };
const listeners = new Set<(s: InitState) => void>();

export const getInit = () => state;
export function onInit(l: (s: InitState) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function startFirework() {
  const sdk = FireworkSDK.getInstance();
  // Firework's own log lines (development builds only): shows in adb logcat under ReactNativeJS.
  sdk.debugLogsEnabled = __DEV__;
  sdk.onSDKInit = (event) => {
    state = event.error ? { status: 'failed', reason: event.error.reason ?? event.error.name } : { status: 'ready' };
    console.log(`[firework] init ${state.status}${state.status === 'failed' ? `: ${state.reason}` : ''}`);
    listeners.forEach((l) => l(state));
  };
  sdk.markInitCalled();
  installHydration();
  installCart();
}
