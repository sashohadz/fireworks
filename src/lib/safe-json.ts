/**
 * JSON for an inline <script> block (set:html). Escaping "<" means a value containing "</script>" can
 * never close the block early and turn data into markup. Use it for every embedded JSON blob.
 */
export const safeJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');
