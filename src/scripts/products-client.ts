// Client-side access to the mock commerce API (/api/products.json), memoised per page view.
export interface ApiUnit {
  id: string;
  name: string;
  option: { name: string; value: string };
  price: number;
  compareAtPrice: number | null;
  stock: number;
  available: boolean;
  isDefault: boolean;
  url: string;
  image: string;
}

export interface ApiProduct {
  id: string;
  handle: string;
  name: string;
  category: string;
  url: string;
  image: string;
  available: boolean;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  units: ApiUnit[];
}

let cache: Promise<ApiProduct[]> | null = null;

export function fetchProducts(): Promise<ApiProduct[]> {
  cache ??= fetch('/api/products.json')
    .then((r) => {
      if (!r.ok) throw new Error(`Mock API returned ${r.status}`);
      return r.json() as Promise<{ products: ApiProduct[] }>;
    })
    .then((data) => data.products);
  return cache;
}

export async function findUnit(unitId: string): Promise<{ product: ApiProduct; unit: ApiUnit } | undefined> {
  for (const product of await fetchProducts()) {
    const unit = product.units.find((u) => u.id === unitId);
    if (unit) return { product, unit };
  }
  return undefined;
}

export const formatEur = (amount: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount);
