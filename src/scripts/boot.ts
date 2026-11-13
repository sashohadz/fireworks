// Runs on every page (from src/layouts/Base.astro).
// Order matters: the event tap must be installed before the Firework SDK is injected.
import { syncSwitchesFromUrl } from '../lab/shopping';
import { mountDebugOverlay } from './debug-overlay';
import { installEventTap } from './event-tap';
import { applyOverrides, loadAnalyticsScript, loadAvaScript, loadFireworkSdk } from './firework-loader';
import { continueRun } from './perf-runner';
import { initPitchMode } from './pitch';
import { effectiveSettings } from './settings';
import { initShopping } from './shopping';
import { initTracking } from './tracking';
import { initUi } from './ui';

export function boot(): void {
  // A performance run (?perf=) watches this page from the start, then moves to the next one.
  continueRun();
  syncSwitchesFromUrl();
  const settings = effectiveSettings();
  window.__fjb = { ...(window.__fjb ?? {}), settings };
  if (settings.debug || document.body.dataset.eventTap === 'on') installEventTap();
  applyOverrides(settings);
  initUi(settings);
  initPitchMode();
  // The shopping hooks register as soon as the SDK defines window._fwn.shopping.
  initShopping(settings);
  // analytics.js first, so it heads the page like in Firework's tracking docs. Tracking waits for whichever script
  // defines window._fwn.analytics.
  loadAnalyticsScript(settings);
  loadFireworkSdk(settings);
  loadAvaScript(settings);
  initTracking(settings);
  if (settings.debug) mountDebugOverlay(settings);
}
