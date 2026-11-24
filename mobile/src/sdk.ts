/**
 * Firework SDK start-up. The native side initialises the SDK in MainApplication.kt; JavaScript only marks that init
 * was called (FireworkSDK.init() must not be called here). The result is kept so the app can say when the App ID is
 * wrong instead of showing empty feeds.
 */
import FireworkSDK from 'react-native-firework-sdk';
import { installCart } from './cart/install';
import { installHydration } from './shopping/install';
import { prefetchMarket } from './shopping/api';
import type { Language } from './market';

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
  // Load the country's price list now, so the first video gets the app's prices without a flash of Firework's.
  prefetchMarket().catch(() => {});
}

/**
 * Firework's own buttons and labels in the shopper's language (Add to cart, Share…): changeAppLanguage. English means
 * null, so the player follows the phone's language as before. The SDK keeps the choice across restarts and, on
 * Android, recreates the activity when it changes (MainActivity.attachBaseContext applies it). JavaScript state, such
 * as the country and language, survives that; screens remount.
 */
export async function applyPlayerLanguage(lang: Language): Promise<boolean> {
  try {
    const ok = await FireworkSDK.getInstance().changeAppLanguage(lang === 'en' ? null : lang);
    console.log(`[firework] changeAppLanguage(${lang === 'en' ? 'null' : lang}): ${ok}`);
    return ok;
  } catch (e) {
    console.log(`[firework] changeAppLanguage failed: ${String(e)}`);
    return false;
  }
}
