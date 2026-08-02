import React from 'react';

import { ContentListRow } from '@/components/common/ContentListRow';
import { CONTENT_TYPE_LABEL } from '@/constants/contentType';
import type { BrowseItemRow } from '@/data/curriculum/browseRepository';

type BrowseRowProps = {
  row: BrowseItemRow;
  onPress: () => void;
  testID?: string;
};

/**
 * A radical / kanji / vocabulary / grammar row in Browse.
 *
 * **BUG7 fix:** this component takes no lock, prerequisite or dependency prop,
 * and there is nowhere to pass one. Browse is discovery — every item is
 * viewable regardless of lesson eligibility (FR67). Dependency-graph gating
 * still governs the *lesson planner*, which is a different question from
 * whether the learner may look something up.
 */
function BrowseRowComponent({ row, onPress, testID }: BrowseRowProps) {
  const typeLabel = CONTENT_TYPE_LABEL[row.itemType];
  // The type lives in the caption here (spec, Browse), so the row carries no
  // separate type badge — the 5px edge and the glyph already colour-code it.
  const caption = row.reading ? `${typeLabel} · ${row.reading}` : typeLabel;

  return (
    <ContentListRow
      rowType={row.itemType}
      glyph={row.primaryForm}
      title={row.meaning}
      caption={caption}
      srsStage={row.srsStage ?? undefined}
      onPress={onPress}
      accessibilityLabel={`${typeLabel}: ${row.primaryForm}, ${row.meaning}`}
      testID={testID}
    />
  );
}

/**
 * Memoized: Browse renders long virtualized lists and re-renders on every
 * keystroke's debounce tick, so rows must not re-render when their data is
 * unchanged (called out in deferred-work.md).
 */
export const BrowseRow = React.memo(BrowseRowComponent);
