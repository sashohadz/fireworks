// A tiny localStorage cart. It plays the role of the merchant's own cart that Firework syncs with.
export interface CartLine {
  productId: string;
  unitId: string;
  quantity: number;
}

const KEY = 'fjb.cart.v1';
export const CART_EVENT = 'fjb:cart-changed';

function read(): CartLine[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as CartLine[];
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.unitId && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

/** Who changed the bag: the site's own buttons, or Add to Bag inside the Firework player. */
export type CartSource = 'site' | 'player';

function write(lines: CartLine[], source: CartSource = 'site'): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage blocked: cart lasts for this page view only */
  }
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { lines, source } }));
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

export function clearCart(): void {
  write([]);
}

export function onCartChange(fn: (lines: CartLine[], source: CartSource) => void): void {
  window.addEventListener(CART_EVENT, (e) => fn(read(), (e as CustomEvent<{ source: CartSource }>).detail.source));
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) fn(read(), 'site');
  });
}
