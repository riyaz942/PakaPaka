import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * Which route detail cross-references navigate into.
 *
 * Browse is the canonical discovery surface, so `/browse/item` is the default.
 * Nested detail screens override it (`/review/item`, `/lesson/item`): pushing a
 * Browse route from inside those stacks would leave the session behind.
 */
export type ItemLinkBase = '/browse/item' | '/review/item' | '/lesson/item';

const ItemLinkContext = createContext<ItemLinkBase>('/browse/item');

export function ItemLinkProvider({
  base,
  children,
}: {
  base: ItemLinkBase;
  children: ReactNode;
}) {
  return <ItemLinkContext.Provider value={base}>{children}</ItemLinkContext.Provider>;
}

export function useItemLinkBase(): ItemLinkBase {
  return useContext(ItemLinkContext);
}

export function useItemHref(): (itemId: string) => string {
  const base = useItemLinkBase();
  return (itemId: string) => `${base}/${itemId}`;
}
