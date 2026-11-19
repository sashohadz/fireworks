/**
 * Cart sync between Firework's player and the app's own cart:
 * - Add to cart in the player → onShoppingCTA → the app checks the store and adds it to its cart (or says why not).
 * - The cart count → setCartItemCount → the red dot on the player's cart icon.
 * - The player's cart icon → onCustomClickCartIcon → the player floats (or closes) and the app opens its Cart tab.
 * Like hydration, these run while the player's own activity is in front: no timers (setTimeout) in here.
 */
import FireworkSDK from 'react-native-firework-sdk';
import { resolveProducts } from '../shopping/hydration';
import { addLog } from '../shopping/log';
import { getMode, modeLabel } from '../shopping/modes';
import { openTab } from '../ui';
import { addToCart, cartCount, getCart, onCart, quantityInCart } from './cart';
import { addedMessage, decideAdd } from './rules';
import { showCartSheet } from './sheet';

export function installCart() {
  const sdk = FireworkSDK.getInstance();
  const shopping = sdk.shopping;
  shopping.cartIconVisible = true;

  shopping.onShoppingCTA = async (event) => {
    const t0 = Date.now();
    const base = { at: new Date(), kind: 'cart' as const, title: `Add to cart · ${modeLabel(getMode())}`, video: event.video?.caption ?? event.video?.videoId, request: `Firework sent: ${event.productId} / ${event.unitId}` };
    try {
      // The same lookup as hydration, so the cart gets the price and stock the player showed.
      const { products, lookup } = await resolveProducts([event.productId], getMode());
      const decision = decideAdd(event.unitId, lookup.found[0], products[0], quantityInCart(event.unitId));
      if (!decision.ok) {
        addLog({ ...base, ms: Date.now() - t0, lines: [{ ok: false, text: decision.reason }] });
        return { res: 'fail', tips: decision.reason };
      }
      addToCart(decision.line);
      const l = decision.line;
      // The "Added to cart" popup over the video, with the cart and Check out. If Firework can't open it, the
      // confirmation falls back to a toast: the bridge shows any tips text, for success as well as failure.
      const popup = await showCartSheet(l.unitId).catch(() => false);
      addLog({ ...base, ms: Date.now() - t0, lines: [{ ok: true, text: `${l.name} (${l.unitName}) €${l.price.toFixed(2)} · cart: ${cartCount()} item${cartCount() === 1 ? '' : 's'} · ${popup ? 'popup shown' : 'toast (popup failed)'}` }] });
      return popup ? { res: 'success' } : { res: 'success', tips: addedMessage(l, cartCount()) };
    } catch (e) {
      const reason = 'The shop can’t be reached right now. Please try again.';
      addLog({ ...base, ms: Date.now() - t0, lines: [{ ok: false, text: e instanceof Error ? e.message : String(e) }] });
      return { res: 'fail', tips: reason };
    }
  };

  shopping.onCustomClickCartIcon = async () => {
    addLog({ at: new Date(), kind: 'cart', title: 'Cart icon', request: 'Firework: the shopper tapped the cart icon', lines: [{ ok: true, text: `Opened the app’s cart (${cartCount()} items)` }] });
    // The player would cover the app's own screens: float it (or close it) first, as Firework's docs recommend.
    await sdk.navigator.tryStartFloatingOrCloseFullScreen();
    openTab('cart');
  };

  // The red dot on the player's cart icon follows the app's cart.
  const sync = () => {
    shopping.setCartItemCount(cartCount(getCart())).catch(() => {});
  };
  onCart(sync);
  sync();
}
