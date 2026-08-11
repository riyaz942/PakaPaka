/** Query keys that define the Content list filter/sort (and list page for back-nav). */
export const LIST_CONTEXT_KEYS = [
  'level',
  'status',
  'skeleton',
  'missing',
  'q',
  'audit',
  'sort',
  'page',
] as const;

/** Keys used when asking the neighbors API (page is list-only). */
export const LIST_FILTER_KEYS = [
  'level',
  'status',
  'skeleton',
  'missing',
  'q',
  'audit',
  'sort',
] as const;

export function pickSearchParams(
  source: URLSearchParams,
  keys: readonly string[],
): URLSearchParams {
  const next = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value !== null && value !== '') {
      next.set(key, value);
    }
  }
  return next;
}

export function listContextSearch(source: URLSearchParams): string {
  const qs = pickSearchParams(source, LIST_CONTEXT_KEYS).toString();
  return qs ? `?${qs}` : '';
}
