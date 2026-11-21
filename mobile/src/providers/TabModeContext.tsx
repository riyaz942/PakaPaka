import { createContext, useContext } from 'react';

/**
 * Web: `browseOnly` is true in a second tab that runs on an in-memory copy of
 * the owner tab's databases. `useHere()` moves PakaPaka to this tab.
 * Always `browseOnly: false` on native.
 */
export type TabModeValue = { browseOnly: boolean; useHere(): void };

export const TabModeContext = createContext<TabModeValue>({
  browseOnly: false,
  useHere: () => {},
});

export function useTabMode(): TabModeValue {
  return useContext(TabModeContext);
}
