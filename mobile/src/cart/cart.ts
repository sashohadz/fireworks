/**
 * The app's own cart: the one place a shopper's items live, whether they were added in Firework's player or
 * anywhere else in the app. Kept in memory (a real app would persist it or keep it on its server).
 * No SDK calls in here, so it runs in Jest; install.ts syncs the count to Firework's cart icon.
 */
export interface CartLine {
  productId: string;
  unitId: string;
  name: string;
  unitName: string;
  /** What the shopper pays per item: the price the player showed (after hydration, e.g. the demo sale). */
  price: number;
  /** The regular price, to show a saving. */
  regularPrice: number;
  /** How many the store has, so the cart can't go over it. */
  stock: number;
  quantity: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

let lines: CartLine[] = [];
const listeners = new Set<(l: CartLine[]) => void>();
const emit = () => listeners.forEach((l) => l(lines));

export const getCart = () => lines;

export function onCart(l: (lines: CartLine[]) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const cartCount = (ls: CartLine[] = lines) => ls.reduce((n, l) => n + l.quantity, 0);
export const cartSubtotal = (ls: CartLine[] = lines) => cents(ls.reduce((s, l) => s + l.price * l.quantity, 0));
export const quantityInCart = (unitId: string, ls: CartLine[] = lines) => ls.find((l) => l.unitId === unitId)?.quantity ?? 0;

/** Adds one (or more) of a unit; the same unit again raises the quantity and takes the latest price. */
export function addToCart(line: Omit<CartLine, 'quantity'>, quantity = 1) {
  const existing = lines.find((l) => l.unitId === line.unitId);
  lines = existing
    ? lines.map((l) => (l.unitId === line.unitId ? { ...l, ...line, quantity: l.quantity + quantity } : l))
    : [...lines, { ...line, quantity }];
  emit();
}

/** 0 or less removes the line; the quantity never goes over the stock. */
export function setQuantity(unitId: string, quantity: number) {
  lines = lines
    .map((l) => (l.unitId === unitId ? { ...l, quantity: Math.min(quantity, l.stock) } : l))
    .filter((l) => l.quantity > 0);
  emit();
}

export function clearCart() {
  lines = [];
  emit();
}
