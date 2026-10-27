// Pitch mode. ?present=<pitch-id> turns it on for this browser tab, ?present=off turns it off.
// The shared tab hides demo tools and shows a small step control; talking points live in a separate
// presenter window (/pitch/<id>) that follows the shared tab over a BroadcastChannel.
// The inline script in Base.astro sets data-present before first paint, so demo tools never flash.

export const PRESENT_KEY = 'fjb.present.v1';
export const PITCH_CHANNEL = 'fjb-pitch';

export interface PitchState {
  pitch: string;
  step: number;
  startedAt: number;
}

interface OutlineStep {
  title: string;
  path?: string;
}
interface Outline {
  id: string;
  title: string;
  steps: OutlineStep[];
}

export type PitchMessage =
  | { type: 'state'; state: PitchState; total: number }
  | { type: 'hello' }
  | { type: 'go'; pitch: string; step: number };

export function loadPitchState(): PitchState | null {
  try {
    const raw = sessionStorage.getItem(PRESENT_KEY);
    return raw ? (JSON.parse(raw) as PitchState) : null;
  } catch {
    return null;
  }
}

function savePitchState(state: PitchState | null): void {
  try {
    if (state) sessionStorage.setItem(PRESENT_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(PRESENT_KEY);
  } catch {
    /* storage blocked: pitch mode lasts for this page only */
  }
}

export const normalisePath = (p: string) => p.replace(/\/+$/, '') || '/';
const stepPath = (s: OutlineStep | undefined) => (s?.path ? normalisePath(new URL(s.path, location.origin).pathname) : null);

function readOutline(): Outline[] {
  try {
    return JSON.parse(document.getElementById('pitch-outline')?.textContent ?? '[]') as Outline[];
  } catch {
    return [];
  }
}

function openChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'function' ? new BroadcastChannel(PITCH_CHANNEL) : null;
  } catch {
    return null;
  }
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

export function initPitchMode(): void {
  const root = document.documentElement;
  // The presenter window never shows the shared-tab controls.
  if (document.body.dataset.pitchNotes === 'on') {
    delete root.dataset.present;
    return;
  }
  const pitches = readOutline();
  const url = new URL(location.href);
  let state = loadPitchState();

  if (url.searchParams.has('present')) {
    const value = url.searchParams.get('present') ?? '';
    if (/^(0|off|false|no)$/i.test(value)) {
      state = null;
    } else {
      const pitch = pitches.find((p) => p.id === value) ?? pitches[0];
      if (pitch && state?.pitch !== pitch.id) {
        // Start at the beginning when opened on the pitch's first page, otherwise at this page's step.
        const here = normalisePath(location.pathname);
        const firstPage = stepPath(pitch.steps.find((s) => s.path));
        const match = pitch.steps.findIndex((s) => stepPath(s) === here);
        state = { pitch: pitch.id, step: here === firstPage || match < 0 ? 0 : match, startedAt: Date.now() };
      }
    }
    savePitchState(state);
    // Keep the shared screen's address bar clean.
    url.searchParams.delete('present');
    history.replaceState(history.state, '', url);
  }

  const pitch = state ? pitches.find((p) => p.id === state!.pitch) : undefined;
  if (!state || !pitch) {
    if (state) savePitchState(null);
    delete root.dataset.present;
    return;
  }
  root.dataset.present = 'on';

  // Follow the presenter when they click around: the step is the one for the current page.
  const here = normalisePath(location.pathname);
  const current = stepPath(pitch.steps[state.step]);
  if (current !== null && current !== here) {
    const match = pitch.steps.findIndex((s) => stepPath(s) === here);
    if (match >= 0) state.step = match;
  }
  state.step = Math.min(Math.max(state.step, 0), pitch.steps.length - 1);
  savePitchState(state);

  const channel = openChannel();
  const announce = () => channel?.postMessage({ type: 'state', state, total: pitch.steps.length } satisfies PitchMessage);

  const goTo = (index: number) => {
    const next = Math.min(Math.max(index, 0), pitch.steps.length - 1);
    state!.step = next;
    savePitchState(state);
    announce();
    const step = pitch.steps[next];
    const target = stepPath(step);
    if (step.path && target !== null && target !== normalisePath(location.pathname)) {
      location.href = step.path;
    } else {
      render();
    }
  };

  const bar = document.createElement('div');
  bar.className = 'pitch-bar';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Pitch controls');
  bar.innerHTML = `
    <button type="button" data-pitch="prev" aria-label="Previous step">‹</button>
    <span class="pitch-bar-count" aria-live="polite"></span>
    <button type="button" data-pitch="next" aria-label="Next step">›</button>
    <button type="button" data-pitch="notes" class="pitch-bar-text">Notes</button>
    <button type="button" data-pitch="exit" aria-label="Leave pitch mode" title="Leave pitch mode">×</button>`;
  const count = bar.querySelector<HTMLElement>('.pitch-bar-count')!;

  function render(): void {
    const step = pitch!.steps[state!.step];
    count.textContent = `${state!.step + 1}/${pitch!.steps.length}`;
    count.title = step.title;
    bar.querySelector<HTMLButtonElement>('[data-pitch="prev"]')!.disabled = state!.step === 0;
    bar.querySelector<HTMLButtonElement>('[data-pitch="next"]')!.disabled = state!.step === pitch!.steps.length - 1;
  }

  bar.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-pitch]')?.dataset.pitch;
    if (action === 'prev') goTo(state!.step - 1);
    if (action === 'next') goTo(state!.step + 1);
    if (action === 'notes') window.open(`/pitch/${pitch.id}`, 'fjb-pitch-notes', 'popup,width=560,height=900');
    if (action === 'exit') {
      savePitchState(null);
      channel?.postMessage({ type: 'state', state: { ...state!, step: -1 }, total: pitch.steps.length } satisfies PitchMessage);
      location.reload();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
    if (e.key === ']') goTo(state!.step + 1);
    if (e.key === '[') goTo(state!.step - 1);
    if (e.key === '\\') bar.classList.toggle('is-hidden');
  });

  channel?.addEventListener('message', (e: MessageEvent<PitchMessage>) => {
    const msg = e.data;
    if (msg?.type === 'hello') announce();
    if (msg?.type === 'go' && msg.pitch === pitch.id) goTo(msg.step);
  });

  render();
  document.body.appendChild(bar);
  announce();
}
