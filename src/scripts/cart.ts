// A tiny localStorage cart. It plays the role of the merchant's own cart that Firework syncs with.
export interface CartLine {
  productId: string;
  unitId: string;
  quantity: number;
}

const KEY = 'fjb.cart.v1';
const ID_KEY = 'fjb.cart.id.v1';
export const CART_EVENT = 'fjb:cart-changed';

/**
 * Who changed the bag: the site's own buttons, Add to Bag inside the Firework player, or a placed order
 * emptying it.
 */
export type CartSource = 'site' | 'player' | 'order';

/** One change to the bag in this tab, with the bag before and after it. */
export interface CartChange {
  cartId: string;
  previous: CartLine[];
  lines: CartLine[];
  source: CartSource;
}

function read(): CartLine[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as CartLine[];
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.unitId && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

let unsavedId: string | null = null;

/**
 * The bag's ID. It becomes the order ID at checkout, so the bag's tracking events and the purchase share one
 * order_id, as in Firework's tracking examples. A new bag starts after each order.
 */
export function cartId(): string {
  try {
    const saved = window.localStorage.getItem(ID_KEY);
    if (saved) return saved;
  } catch {
    /* storage blocked: the ID lasts for this page view */
  }
  unsavedId ??= `FJB-DEMO-${Date.now().toString(36).toUpperCase()}`;
  try {
    window.localStorage.setItem(ID_KEY, unsavedId);
  } catch {
    /* ignore */
  }
  return unsavedId;
}

function forgetCartId(): void {
  unsavedId = null;
  try {
    window.localStorage.removeItem(ID_KEY);
  } catch {
    /* ignore */
  }
}

function write(lines: CartLine[], source: CartSource = 'site'): void {
  const previous = read();
  const id = cartId();
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage blocked: cart lasts for this page view only */
  }
  const detail: CartChange = { cartId: id, previous, lines, source };
  window.dispatchEvent(new CustomEvent<CartChange>(CART_EVENT, { detail }));
}

export const getCart = (): CartLine[] => read();
export const cartCount = (): number => read().reduce((n, l) => n + l.quantity, 0);

export function addToCart(productId: string, unitId: string, quantity = 1): CartLine[] {
  const lines = read();
  const existing = lines.find((l) => l.unitId === unitId);
  if (existing) existing.quantity += quantity;
  else lines.push({ productId, unitId, quantity });
  write(lines);
  return lines;
}

export function setQuantity(unitId: string, quantity: number): CartLine[] {
  const lines = read()
    .map((l) => (l.unitId === unitId ? { ...l, quantity } : l))
    .filter((l) => l.quantity > 0);
  write(lines);
  return lines;
}

/** Sets one line to an exact quantity, adding it if needed. 0 removes it. */
export function setLine(productId: string, unitId: string, quantity: number, source: CartSource = 'site'): CartLine[] {
  const lines = read();
  const index = lines.findIndex((l) => l.unitId === unitId);
  const line = { productId, unitId, quantity };
  if (index < 0) lines.push(line);
  else lines[index] = line;
  const kept = lines.filter((l) => l.quantity > 0);
  write(kept, source);
  return kept;
}

/** Empties the bag. After checkout pass 'order': the purchase event covers those items, so it is not a removal. */
export function clearCart(source: CartSource = 'site'): void {
  write([], source);
  if (source === 'order') forgetCartId();
}

/** Any change to the bag, including changes made in another tab (reported as 'site'). */
export function onCartChange(fn: (lines: CartLine[], source: CartSource) => void): void {
  window.addEventListener(CART_EVENT, (e) => fn(read(), (e as CustomEvent<CartChange>).detail.source));
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) fn(read(), 'site');
  });
}

/** Changes made in this tab only. Tracking uses this, so a change made in two open tabs is not counted twice. */
export function onCartWrite(fn: (change: CartChange) => void): void {
  window.addEventListener(CART_EVENT, (e) => fn((e as CustomEvent<CartChange>).detail));
}
