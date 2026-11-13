// Demo settings: which Firework channel and playlists the page uses, and how the SDK loads.
// Precedence: URL parameters, then the Settings dialog (localStorage), then src/site.config.ts.
import { firework, playlistSlots, type PlaylistSlot } from '../site.config';

export type FwMode = 'on' | 'lazy' | 'off';

/** Names a widget can be picked by in ?widgets=: its playlist slot, or a key for widgets without one. */
export const WIDGET_KEYS = ['hero', 'storyblock', 'carousel', 'grid', 'deck', 'floating', 'live', 'showroom', 'horizontal', 'howto', 'pdp', 'stories', 'ava'] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

export interface SavedSettings {
  channel?: string;
  playlists?: Partial<Record<PlaylistSlot, string>>;
  fwMode?: FwMode;
  debug?: boolean;
}

export interface EffectiveSettings {
  channel: string;
  channelSource: 'url' | 'settings' | 'config' | 'none';
  /** Playlist per slot after overrides. An empty string means "whole channel". */
  playlists: Record<PlaylistSlot, string>;
  /** ?playlist= forces one playlist on every widget of the page (handy in the lab). */
  pagePlaylist: string | null;
  fwMode: FwMode;
  debug: boolean;
  /** ?widgets=carousel,ava keeps only those widgets on the page (lab and measurements). null means all. */
  widgets: WidgetKey[] | null;
  /** True when the page uses the sandbox channel from site.config.ts. */
  isSandbox: boolean;
  /** True when anything differs from site.config.ts. */
  overridden: boolean;
}

const KEY = 'fjb.settings.v1';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSaved(): SavedSettings {
  try {
    return JSON.parse(storage()?.getItem(KEY) ?? '{}') as SavedSettings;
  } catch {
    return {};
  }
}

export function saveSettings(settings: SavedSettings): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable: settings only last for this page view */
  }
}

export function clearSettings(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const isMode = (v: unknown): v is FwMode => v === 'on' || v === 'lazy' || v === 'off';

export function effectiveSettings(search: string = location.search): EffectiveSettings {
  const q = new URLSearchParams(search);
  const saved = loadSaved();

  const urlChannel = q.get('channel')?.trim() ?? '';
  const savedChannel = saved.channel?.trim() ?? '';
  const channel = urlChannel || savedChannel || firework.channel;
  const channelSource = urlChannel ? 'url' : savedChannel ? 'settings' : firework.channel ? 'config' : 'none';
  const isSandbox = Boolean(firework.channel) && channel === firework.channel;

  // Config playlists belong to the sandbox channel, so they only apply while the sandbox is in use.
  const playlists = {} as Record<PlaylistSlot, string>;
  let playlistOverridden = false;
  for (const { slot } of playlistSlots) {
    const savedId = saved.playlists?.[slot]?.trim();
    if (savedId) playlistOverridden = true;
    playlists[slot] = savedId || (isSandbox ? firework.playlists[slot] : '');
  }

  const pagePlaylist = q.has('playlist') ? (q.get('playlist') ?? '').trim() : null;
  const fwParam = q.get('fw');
  const fwMode: FwMode = isMode(fwParam) ? fwParam : isMode(saved.fwMode) ? saved.fwMode : 'on';
  const debug = q.has('debug') ? q.get('debug') !== '0' : Boolean(saved.debug);
  const widgets = q.has('widgets')
    ? (q.get('widgets') ?? '').split(',').map((w) => w.trim()).filter((w): w is WidgetKey => (WIDGET_KEYS as readonly string[]).includes(w))
    : null;

  const overridden =
    channelSource === 'url' ||
    channelSource === 'settings' ||
    playlistOverridden ||
    pagePlaylist !== null ||
    fwMode !== 'on' ||
    widgets !== null;

  return { channel, channelSource, playlists, pagePlaylist, fwMode, debug, widgets, isSandbox, overridden };
}

/** The playlist a given widget should use, or '' for the whole channel. */
export function playlistFor(settings: EffectiveSettings, slot: string | undefined): string {
  if (settings.pagePlaylist !== null) return settings.pagePlaylist;
  if (!slot) return '';
  return settings.playlists[slot as PlaylistSlot] ?? '';
}
