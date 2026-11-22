import type { ParamListBase, RouteProp } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import type { ReactElement } from 'react';

import { BrowseOnlyBlockedScreen } from '@/components/tabs/BrowseOnlyBlockedScreen';
import { isBlockedInBrowseOnly } from '@/core/tabs/browseOnlyRoutes';
import { useTabMode } from '@/providers/TabModeContext';

/**
 * Web browse-only tab: a screen that studies or writes shows the "Browse only"
 * screen instead of its content. It wraps screens through a Stack's
 * `screenLayout` and never replaces a navigator: without a mounted navigator,
 * expo-router drops the navigation and lands somewhere else.
 */
export function BrowseOnlyScreenLayout({ children }: { children: ReactElement }) {
  const { browseOnly } = useTabMode();
  const pathname = usePathname();

  if (browseOnly && isBlockedInBrowseOnly(pathname)) {
    return <BrowseOnlyBlockedScreen />;
  }
  return children;
}

/**
 * `screenLayout` for the root Stack. The `(tabs)` group holds the tab
 * navigator, so it is never replaced; its blocked sections guard their own
 * screens (`browseOnlyScreenLayout` in their layouts). Root sections such as
 * review and lesson are replaced whole, so their providers never mount.
 */
export function browseOnlyRootScreenLayout({
  route,
  children,
}: {
  route: RouteProp<ParamListBase>;
  children: ReactElement;
}): ReactElement {
  if (route.name === '(tabs)') {
    return children;
  }
  return <BrowseOnlyScreenLayout>{children}</BrowseOnlyScreenLayout>;
}

/** `screenLayout` for a blocked section's own Stack inside `(tabs)`. */
export function browseOnlyScreenLayout({ children }: { children: ReactElement }) {
  return <BrowseOnlyScreenLayout>{children}</BrowseOnlyScreenLayout>;
}
