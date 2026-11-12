// Minimal typing for the Firework web SDK global used by this demo.
// Only the parts we call are typed; see https://docs.firework.com/firework-for-developers/web/integration-guide/web-sdk
export {};

declare global {
  /** A product as the player passes it to the shopping hooks. Only the fields we read. */
  interface FwProduct {
    product_ext_id?: string;
    product_name?: string;
  }

  interface FwProductUnit {
    unit_ext_id?: string;
    unit_name?: string;
  }

  interface FwImageBuilder {
    extId(id: string): FwImageBuilder;
    url(url: string): FwImageBuilder;
    title(title: string): FwImageBuilder;
    position(position: number): FwImageBuilder;
  }

  interface FwVariantBuilder {
    extId(id: string): FwVariantBuilder;
    url(url: string): FwVariantBuilder;
    price(price: number): FwVariantBuilder;
    originalPrice(price: number): FwVariantBuilder;
    isAvailable(available: boolean): FwVariantBuilder;
    sku(sku: string): FwVariantBuilder;
    name(name: string): FwVariantBuilder;
    option(option: { name: string; value: string }): FwVariantBuilder;
    image(build: (image: FwImageBuilder) => void): FwVariantBuilder;
  }

  interface FwProductBuilder {
    extId(id: string): FwProductBuilder;
    name(name: string): FwProductBuilder;
    description(description: string): FwProductBuilder;
    currency(currency: string): FwProductBuilder;
    variant(build: (variant: FwVariantBuilder) => void): FwProductBuilder;
  }

  /** Argument of onCartUpdated. The docs list positional arguments; the SDK passes this one object. */
  interface FwCartUpdate {
    product: FwProduct;
    productUnit: FwProductUnit;
    quantity: number;
    previousQuantity: number;
  }

  interface FwCartItem {
    product: unknown;
    unitId: string;
    quantity: number;
  }

  /** https://docs.firework.com/firework-for-developers/web/integration-guide/shopping-integration-v2/shopping-apis */
  interface FwShopping {
    configureCart(config: { url?: string; currency?: string }): void;
    onProductsLoaded(callback: (arg: { products: FwProduct[] }) => Promise<unknown[]>): void;
    onWidgetProductsLoaded?(callback: (arg: { products: FwProduct[] }) => Promise<unknown[]>): void;
    onCartDisplayed(callback: () => Promise<FwCartItem[]>): void;
    onCartUpdated(callback: (update: FwCartUpdate) => Promise<number>): void;
    productFactory(build: (product: FwProductBuilder) => void, validateRequiredFields?: boolean): unknown;
  }

  /** https://docs.firework.com/firework-for-developers/web/integration-guide/shopping-integration-v2/tracking */
  interface FwAnalytics {
    pageViewed?: (data: { ext_customer_identifier?: string }) => void;
    addToCart?: (payload: object) => void;
    removeFromCart?: (payload: object) => void;
    purchase?: (payload: object) => void;
  }

  interface Window {
    _fwn?: {
      console?: () => void;
      /** Defined by analytics.js and by the full SDK, whichever loads first. */
      analytics?: FwAnalytics;
      shopping?: FwShopping;
      player?: Record<string, unknown>;
      players?: Record<string, unknown>;
    };
    __fjb?: Record<string, unknown>;
  }
}
