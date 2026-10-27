// Runs on every page (from src/layouts/Base.astro).
// Order matters: the event tap must be installed before the Firework SDK is injected.
import { mountDebugOverlay } from './debug-overlay';
import { installEventTap } from './event-tap';
import { applyOverrides, loadAvaScript, loadFireworkSdk } from './firework-loader';
import { initPitchMode } from './pitch';
import { effectiveSettings } from './settings';
import { initUi } from './ui';

export function boot(): void {
  const settings = effectiveSettings();
  window.__fjb = { ...(window.__fjb ?? {}), settings };
  if (settings.debug || document.body.dataset.eventTap === 'on') installEventTap();
  applyOverrides(settings);
  initUi(settings);
  initPitchMode();
  loadFireworkSdk(settings);
  loadAvaScript(settings);
  if (settings.debug) mountDebugOverlay(settings);
}
