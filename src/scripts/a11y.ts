// Accessibility tools for /lab/accessibility: an axe-core audit that tells Firework widgets apart from the
// page, and a focus tracker that follows focus into open shadow roots.
// axe-core is loaded only when an audit runs, so it never weighs on other pages.
import type { AxeResults, ElementContext, NodeResult, Result } from 'axe-core';

const FW_TAGS = /fw-(embed-feed|storyblock|player-deck|herounit|player)\b/;
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

const flatTarget = (node: NodeResult) => JSON.stringify(node.target);
const inWidget = (node: NodeResult) => FW_TAGS.test(flatTarget(node));

/** wcag143 becomes 1.4.3; level tags such as wcag2aa are left out. */
function criteria(tags: string[]): string {
  return tags
    .map((t) => t.match(/^wcag(\d)(\d)(\d{1,2})$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => `${m[1]}.${m[2]}.${m[3]}`)
    .join(', ');
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function row(result: Result): HTMLTableRowElement {
  const tr = el('tr');
  const impact = result.impact ?? 'minor';
  tr.appendChild(el('td')).appendChild(el('span', impact, `impact impact-${impact}`));

  const rule = tr.appendChild(el('td'));
  const link = el('a', result.help);
  link.href = result.helpUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  rule.append(link, el('div', result.id, 'small muted'));
  const details = el('details');
  details.appendChild(el('summary', `${result.nodes.length} element${result.nodes.length === 1 ? '' : 's'}`));
  for (const node of result.nodes.slice(0, 5)) {
    details.appendChild(el('pre', `${node.target.map((t) => (Array.isArray(t) ? t.join(' >>> ') : t)).join(' ')}\n${node.failureSummary ?? ''}`));
  }
  if (result.nodes.length > 5) details.appendChild(el('p', `and ${result.nodes.length - 5} more`, 'small muted'));
  rule.appendChild(details);

  tr.appendChild(el('td', criteria(result.tags) || '-'));
  const widget = result.nodes.filter(inWidget).length;
  const page = result.nodes.length - widget;
  tr.appendChild(el('td', [widget ? `${widget} in widgets` : '', page ? `${page} on page` : ''].filter(Boolean).join(', ')));
  return tr;
}

export interface AuditOptions {
  scope: 'widgets' | 'page';
  bestPractices: boolean;
  summary: HTMLElement;
  tbody: HTMLElement;
  wrap: HTMLElement;
}

export async function auditWidgets(opts: AuditOptions): Promise<AxeResults | null> {
  const { summary, tbody, wrap } = opts;
  const hosts = [...document.querySelectorAll('fw-embed-feed, fw-storyblock, fw-player-deck, fw-herounit, fw-player')];
  if (opts.scope === 'widgets' && hosts.length === 0) {
    summary.textContent = 'No Firework widgets on the page. Set a channel in Settings, or audit the whole page.';
    return null;
  }
  summary.textContent = 'Loading axe-core and running the audit…';
  const axe = (await import('axe-core')).default;
  const context: ElementContext = opts.scope === 'widgets' ? { include: hosts.map((h) => [h.tagName.toLowerCase() + (h.getAttribute('name') ? `[name="${h.getAttribute('name')}"]` : '')]) } : document;
  let results: AxeResults;
  try {
    results = await axe.run(context, {
      runOnly: { type: 'tag', values: opts.bestPractices ? [...WCAG_TAGS, 'best-practice'] : WCAG_TAGS },
      resultTypes: ['violations'],
    });
  } catch (error) {
    summary.textContent = `The audit failed: ${error instanceof Error ? error.message : String(error)}`;
    return null;
  }

  const violations = [...results.violations].sort(
    (a, b) => IMPACT_ORDER.indexOf(a.impact ?? 'minor') - IMPACT_ORDER.indexOf(b.impact ?? 'minor'),
  );
  const nodes = violations.reduce((n, v) => n + v.nodes.length, 0);
  const widgetNodes = violations.reduce((n, v) => n + v.nodes.filter(inWidget).length, 0);
  summary.textContent =
    violations.length === 0
      ? `No violations found by ${results.testEngine.name} ${results.testEngine.version}. ${results.incomplete.length} rules need a manual review.`
      : `${violations.length} rules failed on ${nodes} elements, ${widgetNodes} of them inside Firework widgets. ${results.incomplete.length} more rules need a manual review.`;
  tbody.replaceChildren(...violations.map(row));
  wrap.hidden = violations.length === 0;
  return results;
}

/** The element that really has focus, looking through open shadow roots. */
function deepActiveElement(): { element: Element | null; hosts: Element[] } {
  const hosts: Element[] = [];
  let element: Element | null = document.activeElement;
  while (element?.shadowRoot?.activeElement) {
    hosts.push(element);
    element = element.shadowRoot.activeElement;
  }
  return { element, hosts };
}

function describe(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute('role');
  const name =
    element.getAttribute('aria-label') ??
    element.getAttribute('title') ??
    element.getAttribute('alt') ??
    (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50);
  return `<${tag}${role ? ` role="${role}"` : ''}>${name ? ` "${name}"` : ' (no accessible name found)'}`;
}

/** A rough check for a visible focus indicator: an outline or a box shadow on the focused element. */
function hasFocusRing(element: Element): boolean {
  const style = getComputedStyle(element);
  const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  return outline || (style.boxShadow !== 'none' && style.boxShadow !== '');
}

export function initFocusTracker(now: HTMLElement, log: HTMLElement): void {
  const MAX = 15;
  document.addEventListener('focusin', () => {
    // Read the element now, because fast tabbing moves focus again before the next frame.
    const { element, hosts } = deepActiveElement();
    if (!element || element === document.body) return;
    // Wait a frame so :focus-visible styles apply before reading them.
    requestAnimationFrame(() => {
      const inside = hosts.length ? ` inside <${hosts.map((h) => h.tagName.toLowerCase()).join('> <')}>` : '';
      const ring = hasFocusRing(element) ? '' : ' · no outline or box shadow on the element';
      const text = `${describe(element)}${inside}${ring}`;
      now.textContent = text;
      const item = el('li', text);
      log.prepend(item);
      while (log.children.length > MAX) log.lastElementChild?.remove();
    });
  });
}
