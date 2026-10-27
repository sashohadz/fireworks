// Builds the HTML a customer would paste for a Firework widget. Shared by build-time and client code.
import { firework } from '../site.config';

export function sdkScriptTags(): string {
  return [
    `<script async type="module" src="${firework.scripts.module}"></script>`,
    `<script async nomodule src="${firework.scripts.nomodule}"></script>`,
  ].join('\n');
}

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function elementSnippet(tag: string, attrs: Record<string, string>): string {
  const entries = Object.entries(attrs).filter(([, v]) => v !== '');
  if (entries.length === 0) return `<${tag}></${tag}>`;
  return `<${tag}\n${entries.map(([k, v]) => `  ${k}="${escapeAttr(v)}"`).join('\n')}\n></${tag}>`;
}

export function cssSnippet(vars: Record<string, string>): string {
  const entries = Object.entries(vars).filter(([, v]) => v.trim() !== '');
  if (entries.length === 0) return '';
  return `<style>\n  :root {\n${entries.map(([k, v]) => `    ${k}: ${v};`).join('\n')}\n  }\n</style>`;
}

export function fullSnippet(tag: string, attrs: Record<string, string>, cssVars: Record<string, string> = {}): string {
  const css = cssSnippet(cssVars);
  return [`<!-- Firework SDK: add once per page -->`, sdkScriptTags(), '', ...(css ? [css, ''] : []), elementSnippet(tag, attrs)].join('\n');
}
