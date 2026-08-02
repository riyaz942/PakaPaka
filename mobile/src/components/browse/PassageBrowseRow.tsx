import React from 'react';

import { ContentListRow } from '@/components/common/ContentListRow';
import { PASSAGE_CONTENT_LABEL } from '@/constants/contentType';
import type { BrowsePassageRow } from '@/data/curriculum/browseRepository';

type PassageBrowseRowProps = {
  row: BrowsePassageRow;
  onPress: () => void;
  testID?: string;
};

/**
 * A reading-passage row in Browse (FR66, UX-DR13–14).
 *
 * Lock here is passage-specific and derived from study coverage — unrelated to
 * the item dependency graph, which Browse never applies to item rows. A locked
 * passage is framed as a destination ("3 to go"), never a bare padlock: the row
 * stays tappable so the learner can see what they are working toward.
 */
function PassageBrowseRowComponent({ row, onPress, testID }: PassageBrowseRowProps) {
  const remainingLabel =
    row.itemsRemainingToUnlock > 0 ? `${row.itemsRemainingToUnlock} to go` : 'Almost there';

  // Bilingual one-liner (FR66): the Japanese half leads in `font-jp`, the
  // English half follows underneath. Either may be missing.
  const caption = row.summaryJa ?? row.summaryEn ?? undefined;
  const captionSecondary = row.summaryJa ? (row.summaryEn ?? undefined) : undefined;

  return (
    <ContentListRow
      rowType="passage"
      title={row.title}
      caption={caption}
      captionSecondary={captionSecondary}
      // The countdown pill is gold, not slate: it names what the learner still
      // has to study, not the passage itself (spec, Browse).
      trailingLabel={row.locked ? remainingLabel : undefined}
      trailingClassName="bg-content-grammar-soft"
      trailingTextClassName="text-content-grammar-deep"
      trailingTestID={testID ? `${testID}-lock` : undefined}
      onPress={onPress}
      accessibilityLabel={
        row.locked
          ? `${PASSAGE_CONTENT_LABEL}: ${row.title}. ${remainingLabel} until it opens`
          : `${PASSAGE_CONTENT_LABEL}: ${row.title}`
      }
      testID={testID}
    />
  );
}

export const PassageBrowseRow = React.memo(PassageBrowseRowComponent);
