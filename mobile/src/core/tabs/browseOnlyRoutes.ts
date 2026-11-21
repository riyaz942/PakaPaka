/**
 * Web browse-only tab: routes that study or write. They show the "Browse only"
 * screen instead. Matched by the first path segment, so `/reviews-history`
 * is not caught by `/review`.
 */
const BLOCKED_FIRST_SEGMENTS = new Set([
  'review',
  'lesson',
  'settings',
  'converse',
  'onboarding',
  'levels',
  'start',
  'learn',
]);

export function isBlockedInBrowseOnly(pathname: string): boolean {
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';
  return BLOCKED_FIRST_SEGMENTS.has(firstSegment);
}
