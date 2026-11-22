import { isBlockedInBrowseOnly } from '@/core/tabs/browseOnlyRoutes';

describe('isBlockedInBrowseOnly', () => {
  it.each([
    '/review',
    '/review/item/k1',
    '/lesson',
    '/lesson/preview',
    '/settings',
    '/settings/about',
    '/onboarding/welcome',
    '/levels',
    '/start',
    '/learn',
    '/converse',
  ])('%s is blocked', (pathname) => {
    expect(isBlockedInBrowseOnly(pathname)).toBe(true);
  });

  it.each([
    '/',
    '/dashboard',
    '/browse',
    '/browse/item/k1',
    '/browse/passage/p1',
    '/stats',
    '/read',
  ])('%s is open', (pathname) => {
    expect(isBlockedInBrowseOnly(pathname)).toBe(false);
  });

  it('/reviews-history is not blocked by prefix accident', () => {
    expect(isBlockedInBrowseOnly('/reviews-history')).toBe(false);
    expect(isBlockedInBrowseOnly('/starter')).toBe(false);
  });
});
