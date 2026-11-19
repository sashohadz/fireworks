/**
 * The "Added to cart" popup over Firework's player. navigator.pushRNContainer opens Firework's container screen
 * (FWContainerActivity) on top of the full-screen player and renders the component registered under appKey; our
 * manifest gives that screen a transparent theme, so the popup sits over the video.
 */
import FireworkSDK from 'react-native-firework-sdk';
import { addLog } from '../shopping/log';
import { getTab, openTab } from '../ui';

export const CART_SHEET = 'FjordbloomCartSheet';

/**
 * Opens the popup. The popup reads what was added from the cart itself (getLastAdded), but appProps must still be
 * passed: the Android bridge casts it to a map without a null check, so leaving it out crashes the app.
 * Resolves false if Firework couldn't open the screen.
 */
export function showCartSheet(unitId: string): Promise<boolean> {
  return FireworkSDK.getInstance().navigator.pushRNContainer({ appKey: CART_SHEET, appProps: { initialParams: { unitId } } });
}

/** Back to the video. */
export function keepWatching(): Promise<boolean> {
  return FireworkSDK.getInstance().navigator.popRNContainer();
}

let checkoutRequested = false;

/**
 * Check out, step 1: close the popup and remember why. The player can't be floated or closed while the popup is
 * still on top: Firework only closes the player when it is the screen in front, and the popup takes a moment to
 * finish. So step 2 runs when the popup's React tree is torn down (CartSheet's unmount), when the player is back in
 * front, the same situation as the player's own cart icon.
 */
export async function requestCheckout(): Promise<void> {
  checkoutRequested = true;
  const closed = await FireworkSDK.getInstance().navigator.popRNContainer();
  console.log(`[cart] Check out tapped in the popup; popup closing: ${closed}`);
}

/** Check out, step 2, called when the popup is gone: float (or close) the player and open the app's Cart tab. */
export async function afterSheetClosed(): Promise<void> {
  if (!checkoutRequested) { return; }
  checkoutRequested = false;
  const from = getTab();
  const moved = await FireworkSDK.getInstance().navigator.tryStartFloatingOrCloseFullScreen();
  openTab('cart');
  // Only Firework's full-screen player can float. An inline Storyblock plays inside the app's own screen, so there is
  // nothing to float: its video stops when the Cart tab replaces the Storyblock tab.
  const text = moved
    ? 'Player floated (or closed); Cart tab opened'
    : from === 'storyblock'
      ? 'Inline Storyblock: no full-screen player to float, the video stops; Cart tab opened'
      : 'Firework could not float or close the player; Cart tab opened';
  addLog({ at: new Date(), kind: 'cart', title: 'Check out from the popup', lines: [{ ok: true, text }] });
}
