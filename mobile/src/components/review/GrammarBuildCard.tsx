import { Text, View } from 'react-native';

import { LinkedSentence } from '@/components/common/LinkedSentence';
import { LinkedWord } from '@/components/common/LinkedWord';
import type { ReviewItem } from '@/core/srs/srs.types';

type GrammarBuildCardProps = {
  item: ReviewItem;
  /** True once the card has a terminal result: the correct sentence shows. */
  answered: boolean;
};

/**
 * Build card (spec §3.2): the English sentence, its words in dictionary form
 * and a polite/plain tag; the learner types the whole sentence in Japanese.
 * Every word links at all times, and its furigana follows its own mastery.
 */
export function GrammarBuildCard({ item, answered }: GrammarBuildCardProps) {
  const sentence = item.grammarBuild;
  if (!sentence) return null;
  return (
    <View className="w-full items-center gap-space-md">
      <Text className="text-title font-ui-semibold text-primary text-center">{sentence.english}</Text>
      <View className="rounded-radius-md border border-border px-space-sm">
        <Text className="text-caption font-ui-semibold text-secondary">{sentence.register}</Text>
      </View>
      <View className="flex-row flex-wrap items-end justify-center gap-space-sm">
        {sentence.vocabulary.map((entry) => (
          <LinkedWord
            key={entry.itemId}
            text={entry.furigana ?? entry.primaryForm}
            surface={entry.primaryForm}
            vocabularyItemId={entry.itemId}
            inflection={null}
            textClassName="text-body-lg font-jp-medium"
            testID={`grammar-build-vocab-${entry.itemId}`}
          />
        ))}
      </View>
      {answered ? (
        <LinkedSentence
          japanese={sentence.japanese}
          furigana={sentence.furigana}
          spans={sentence.spans}
          testIDPrefix="grammar-build-answer"
          sentenceId={sentence.sentenceKey}
          grammarSpan={{ ...sentence.grammarSpan, locked: false, itemId: item.itemId }}
        />
      ) : null}
    </View>
  );
}
