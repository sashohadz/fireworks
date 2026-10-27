// Shared page chrome: cart badge, Settings dialog, override banner, copy buttons and toasts.
import { firework, playlistSlots } from '../site.config';
import { cartCount, onCartChange } from './cart';
import { clearSettings, loadSaved, saveSettings, type EffectiveSettings, type FwMode, type SavedSettings } from './settings';

const OVERRIDE_PARAMS = ['channel', 'playlist', 'fw', 'debug'];

export function toast(message: string): void {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 2600);
}

function updateCartBadge(): void {
  const n = cartCount();
  document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
}

function reloadWithoutOverrideParams(): void {
  const url = new URL(location.href);
  OVERRIDE_PARAMS.forEach((p) => url.searchParams.delete(p));
  location.href = url.toString();
}

function initSettingsDialog(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#settings-dialog');
  if (!dialog) return;
  const form = dialog.querySelector('form')!;
  const field = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;

  const populate = () => {
    const saved = loadSaved();
    field<HTMLInputElement>('set-channel').value = saved.channel ?? '';
    field<HTMLInputElement>('set-channel').placeholder = firework.channel || 'e.g. my_sandbox_channel';
    field<HTMLSelectElement>('set-fw-mode').value = saved.fwMode ?? 'on';
    field<HTMLInputElement>('set-debug').checked = Boolean(saved.debug);
    for (const { slot } of playlistSlots) {
      const input = field<HTMLInputElement>(`set-pl-${slot}`);
      input.value = saved.playlists?.[slot] ?? '';
      input.placeholder = firework.playlists[slot] || 'whole channel';
    }
  };

  document.querySelectorAll('[data-open-settings]').forEach((btn) =>
    btn.addEventListener('click', () => {
      populate();
      dialog.showModal();
    }),
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'cancel') return dialog.close();
    if (submitter?.value === 'reset') {
      clearSettings();
      return reloadWithoutOverrideParams();
    }
    const playlists: SavedSettings['playlists'] = {};
    for (const { slot } of playlistSlots) {
      const v = field<HTMLInputElement>(`set-pl-${slot}`).value.trim();
      if (v) playlists[slot] = v;
    }
    const channel = field<HTMLInputElement>('set-channel').value.trim();
    const fwMode = field<HTMLSelectElement>('set-fw-mode').value as FwMode;
    saveSettings({
      channel: channel || undefined,
      playlists,
      fwMode: fwMode === 'on' ? undefined : fwMode,
      debug: field<HTMLInputElement>('set-debug').checked || undefined,
    });
    reloadWithoutOverrideParams();
  });
}

function initOverrideBanner(settings: EffectiveSettings): void {
  const banner = document.querySelector<HTMLElement>('#override-banner');
  if (!banner) return;
  const parts: string[] = [];
  if (settings.channelSource === 'none') {
    parts.push('No Firework channel is configured yet, so widgets show placeholders.');
  } else if (settings.channelSource === 'url' || settings.channelSource === 'settings') {
    parts.push(`Showing channel “${settings.channel}” from ${settings.channelSource === 'url' ? 'the URL' : 'your saved settings'}.`);
    if (!settings.isSandbox) parts.push('Purchase tracking is off for non-sandbox channels.');
  }
  if (settings.pagePlaylist !== null) parts.push(`Playlist forced to “${settings.pagePlaylist || 'whole channel'}”.`);
  if (settings.fwMode !== 'on') parts.push(`Firework SDK mode: ${settings.fwMode}.`);
  if (parts.length === 0) return;
  banner.className = 'override-banner';
  banner.innerHTML = '';
  const text = document.createElement('span');
  text.textContent = parts.join(' ');
  banner.appendChild(text);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'link-btn';
  if (settings.channelSource === 'none') {
    btn.textContent = 'Open settings';
    btn.setAttribute('data-open-settings', '');
  } else {
    btn.textContent = 'Reset to defaults';
    btn.addEventListener('click', () => {
      clearSettings();
      reloadWithoutOverrideParams();
    });
  }
  banner.appendChild(btn);
  banner.hidden = false;
}

function initCopyButtons(): void {
  document.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-target]');
    if (!btn) return;
    const target = document.getElementById(btn.dataset.copyTarget!);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.textContent ?? '');
      const label = btn.textContent;
      btn.textContent = 'Copied';
      window.setTimeout(() => (btn.textContent = label), 1500);
    } catch {
      toast('Copy failed: select the text and copy it manually.');
    }
  });
}

export function initUi(settings: EffectiveSettings): void {
  updateCartBadge();
  onCartChange(updateCartBadge);
  initOverrideBanner(settings);
  initSettingsDialog();
  initCopyButtons();
}
