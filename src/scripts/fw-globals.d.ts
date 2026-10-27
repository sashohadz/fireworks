// Minimal typing for the Firework web SDK global used by this demo.
// Only the parts we call are typed; see https://docs.firework.com/firework-for-developers/web/integration-guide/web-sdk
export {};

declare global {
  interface Window {
    _fwn?: {
      console?: () => void;
      analytics?: {
        purchase?: (payload: Record<string, unknown>) => void;
      };
      shopping?: Record<string, unknown>;
      player?: Record<string, unknown>;
      players?: Record<string, unknown>;
    };
    __fjb?: Record<string, unknown>;
  }
}
