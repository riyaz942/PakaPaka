import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { LinkedSentence } from '@/components/common/LinkedSentence';
import { useItemHref } from '@/components/learn/ItemLinkContext';
import type { GrammarVocabEntry, ReviewItem } from '@/core/srs/srs.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { isVocabularyItemKnown } from '@/data/user/masteryRepository';

type GrammarBuildCardProps = {
  item: ReviewItem;
  /** True once the card has a terminal result: the sentence shows. */
  answered: boolean;
};

/**
 * Build card (spec §3.2): the English sentence, its words in dictionary form
 * and a polite/plain tag; the learner types the whole sentence in Japanese.
 * Every word links to its detail page, before and after answering.
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
          <VocabWord key={entry.itemId} entry={entry} />
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

function VocabWord({ entry }: { entry: GrammarVocabEntry }) {
  const { userDb } = useDatabase();
  const { knownKanji, modeForItem } = useFuriganaPreference();
  const hrefFor = useItemHref();
  const word = (
    <FuriganaText
      text={entry.furigana ?? entry.primaryForm}
      mode={modeForItem(entry.itemId)}
      knownKanji={knownKanji}
      // Per-word mastery: a word not learned yet always shows its reading.
      isKnownWord={isVocabularyItemKnown(userDb, entry.itemId)}
      interactive={false}
      className="text-body-lg font-jp-medium text-content-vocabulary-deep underline"
    />
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.primaryForm}, show word details`}
      onPress={() => router.push(hrefFor(entry.itemId) as Href)}
      testID={`grammar-build-vocab-${entry.itemId}`}>
      {word}
    </Pressable>
  );
}
