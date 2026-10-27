// URL parameters for the OBS overlays in src/pages/live/overlays/.
// Text is only ever set with textContent, so a URL cannot inject markup into a live stream.
//   <el data-param="title">Default text</el>   replaced by ?title=...
//   data-optional                               hides the element when its text is empty
//   ?pos=top|middle|bottom   ?hold=<seconds>   ?hd=1 (1080x1920 canvas)   ?bg=1 and ?guides=1 (previews only)

export const MAX_TEXT = 140;

export function initOverlay(): URLSearchParams {
  const q = new URLSearchParams(location.search);
  const canvas = document.querySelector<HTMLElement>('.canvas')!;
  if (q.get('bg') === '1') canvas.classList.add('has-bg');
  if (q.get('guides') === '1') canvas.classList.add('show-guides');
  // Accounts with 1080p streaming use a 1080x1920 OBS canvas: same layout, scaled by 1.5.
  if (q.get('hd') === '1') document.documentElement.style.setProperty('zoom', '1.5');

  document.querySelectorAll<HTMLElement>('[data-param]').forEach((el) => {
    const value = q.get(el.dataset.param!);
    if (value !== null) el.textContent = value.trim().slice(0, MAX_TEXT);
    if (el.hasAttribute('data-optional') && !el.textContent?.trim()) el.hidden = true;
  });

  const pos = q.get('pos');
  if (pos && /^(top|middle|bottom)$/.test(pos)) {
    document.querySelectorAll<HTMLElement>('[data-pos]').forEach((el) => {
      el.classList.remove('pos-top', 'pos-middle', 'pos-bottom');
      el.classList.add(`pos-${pos}`);
    });
  }

  // Two frames, so the entry transition runs even when OBS renders the first frame late.
  requestAnimationFrame(() => requestAnimationFrame(() => canvas.classList.add('is-in')));
  const hold = Number(q.get('hold'));
  if (Number.isFinite(hold) && hold > 0) window.setTimeout(() => canvas.classList.remove('is-in'), hold * 1000 + 600);
  return q;
}
