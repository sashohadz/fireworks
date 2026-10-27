// Runs on every page (from src/layouts/Base.astro).
// Order matters: the event tap must be installed before the Firework SDK is injected.
import { mountDebugOverlay } from './debug-overlay';
import { installEventTap } from './event-tap';
import { applyOverrides, loadFireworkSdk } from './firework-loader';
import { effectiveSettings } from './settings';
import { initUi } from './ui';

export function boot(): void {
  const settings = effectiveSettings();
  window.__fjb = { ...(window.__fjb ?? {}), settings };
  if (settings.debug || document.body.dataset.eventTap === 'on') installEventTap();
  applyOverrides(settings);
  initUi(settings);
  loadFireworkSdk(settings);
  if (settings.debug) mountDebugOverlay(settings);
}
