import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { SectionHeading } from '@/components/common/SectionHeading';
import {
  lookAlike,
  WORD_GROUP_LABEL,
  type ConjugationForm,
} from '@/core/content/conjugation';
import { listSamePatternWords, type CurriculumItemDetail } from '@/data/curriculum/itemRepository';
import { useConjugationTable } from '@/data/hooks/useConjugationTable';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';
import { useIsKnownWord } from '@/data/hooks/useIsKnownWord';

const COLUMNS = ['Non-past', 'Past'] as const;

/** Grid rows: label, then the [non-past, past] forms. */
const ROWS: readonly { label: string; forms: readonly [ConjugationForm, ConjugationForm] }[] = [
  { label: '+ casual', forms: ['plain', 'plainPast'] },
  { label: '− casual', forms: ['plainNegative', 'plainPastNegative'] },
  { label: '+ polite', forms: ['polite', 'politePast'] },
  { label: '− polite', forms: ['politeNegative', 'politePastNegative'] },
];

/**
 * The word's 8 basic forms, generated from its conjugation class. Renders
 * nothing for a word with no class, or one the conjugator is unsure about.
 */
export function ConjugationTableSection({ item }: { item: CurriculumItemDetail }) {
  const { curriculumDb } = useDatabase();
  const { modeForItem } = useFuriganaPreference();
  const isKnownWord = useIsKnownWord(item.id);
  const conjugation = useConjugationTable(item);

  const details = useMemo(() => {
    if (!conjugation) {
      return null;
    }
    const word = { primaryForm: item.primaryForm, furigana: item.furigana };
    const exception = lookAlike(word, conjugation.cls);
    const samePattern = listSamePatternWords(
      curriculumDb,
      item.id,
      conjugation.cls,
      exception !== null,
    );
    return { exception, samePattern };
  }, [conjugation, curriculumDb, item.id, item.primaryForm, item.furigana]);

  if (!conjugation || !details) {
    return null;
  }

  const { cls, table } = conjugation;
  const mode = modeForItem(item.id);

  return (
    <View className="mt-space-md" testID="conjugation-table">
      <SectionHeading label="How it conjugates" />
      <Text
        className="mt-space-xs text-body-sm font-ui-medium text-secondary"
        testID="conjugation-word-group">
        {WORD_GROUP_LABEL[cls]}
      </Text>

      {details.exception ? (
        <View className="mt-space-sm" testID="conjugation-look-alike">
          <SectionHeading label="How to tell" />
          <Text className="mt-space-xs text-body-sm font-ui-medium text-primary">
            {details.exception.tag}
          </Text>
          <Text className="mt-space-xs text-body-sm font-ui text-secondary">
            {details.exception.note}
          </Text>
        </View>
      ) : null}

      <View className="mt-space-sm gap-space-xs rounded-radius-md border border-border bg-surface px-space-md py-space-sm">
        <View className="flex-row">
          <View className="flex-1" />
          {COLUMNS.map((column) => (
            <Text key={column} className="flex-[2] text-caption font-ui-medium text-secondary">
              {column}
            </Text>
          ))}
        </View>
        {ROWS.map((row) => (
          <View key={row.label} className="flex-row items-end">
            <Text className="flex-1 text-caption font-ui text-muted">{row.label}</Text>
            {row.forms.map((form) => (
              <View key={form} className="flex-[2]" testID={`conjugation-cell-${form}`}>
                <FuriganaText
                  text={table[form].furigana}
                  mode={mode}
                  isKnownWord={isKnownWord}
                  className="text-body font-jp-medium text-content-vocabulary-deep"
                />
              </View>
            ))}
          </View>
        ))}
      </View>

      {details.samePattern.length > 0 ? (
        <Text className="mt-space-sm text-body-sm font-ui text-secondary">
          Same pattern as {details.samePattern.map((word) => word.primaryForm).join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}
