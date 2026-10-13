import { Text, View } from 'react-native';

import { LinkedSentence } from '@/components/common/LinkedSentence';
import type { ReviewItem } from '@/core/srs/srs.types';

type GrammarReadCardProps = {
  item: ReviewItem;
  /** True once the card has a terminal result: the grammar unlocks and the English shows. */
  answered: boolean;
};

/**
 * Read card (spec §3.1): a sentence with the grammar highlighted; the learner
 * types what the grammar means. Every word links at all times (D12); the
 * grammar span itself stays locked until the card is answered.
 */
export function GrammarReadCard({ item, answered }: GrammarReadCardProps) {
  const sentence = item.grammarRead;
  if (!sentence) return null;
  return (
    <View className="w-full items-center gap-space-md">
      <LinkedSentence
        japanese={sentence.japanese}
        furigana={sentence.furigana}
        spans={sentence.spans}
        testIDPrefix="grammar-read"
        sentenceId={sentence.sentenceKey}
        textClassName="text-title-lg font-jp-medium"
        grammarSpan={{ ...sentence.grammarSpan, locked: !answered, itemId: item.itemId }}
      />
      {answered ? (
        <Text className="text-body font-ui text-secondary text-center">{sentence.english}</Text>
      ) : (
        <Text className="text-body font-ui-semibold text-secondary text-center">
          What does the highlighted grammar mean?
        </Text>
      )}
    </View>
  );
}
