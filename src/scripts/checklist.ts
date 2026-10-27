// Makes Markdown task lists (- [ ] item) on Learn pages tickable. Ticks are a per-browser convenience,
// saved in localStorage per page, and the page works the same when storage is blocked.

const keyFor = (path: string) => `fjb.checklist.v1:${path.replace(/\/+$/, '') || '/'}`;

function load(key: string): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as number[]);
  } catch {
    return new Set();
  }
}

function save(key: string, ticked: Set<number>): void {
  try {
    if (ticked.size) localStorage.setItem(key, JSON.stringify([...ticked]));
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked: ticks last for this page view */
  }
}

export function initChecklists(root: ParentNode = document): void {
  const boxes = [...root.querySelectorAll<HTMLInputElement>('.prose li > input[type="checkbox"]')];
  if (boxes.length === 0) return;
  const key = keyFor(location.pathname);
  const ticked = load(key);

  const progress = document.createElement('div');
  progress.className = 'checklist-progress';
  progress.setAttribute('aria-live', 'polite');
  const text = document.createElement('span');
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'link-btn';
  reset.textContent = 'Clear ticks';
  progress.append(text, reset);
  // After the page intro on Learn pages, otherwise right before the first list.
  const lede = boxes[0]!.closest('.prose')?.querySelector(':scope > .lede');
  if (lede) lede.after(progress);
  else boxes[0]!.closest('ul, ol')!.before(progress);

  const render = () => {
    text.textContent = `${ticked.size} of ${boxes.length} done.`;
    reset.hidden = ticked.size === 0;
  };

  boxes.forEach((box, i) => {
    box.disabled = false;
    box.checked = ticked.has(i);
    box.id = `check-${i}`;
    // Wrap the item text in a label, so the whole line toggles the box.
    const label = document.createElement('label');
    label.htmlFor = box.id;
    while (box.nextSibling) label.appendChild(box.nextSibling);
    box.after(label);
    box.addEventListener('change', () => {
      if (box.checked) ticked.add(i);
      else ticked.delete(i);
      save(key, ticked);
      render();
    });
  });

  reset.addEventListener('click', () => {
    ticked.clear();
    boxes.forEach((b) => (b.checked = false));
    save(key, ticked);
    render();
  });
  render();
}
