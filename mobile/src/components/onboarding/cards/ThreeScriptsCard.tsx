import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { getItemBySlug } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

/**
 * The three scripts, one row each. The glyphs, readings and meanings are real
 * curriculum rows (looked up by slug, which is stable across a recompile); only
 * the one-line "what this script is for" is app-authored, the same split as
 * `components/learn/explainerContent.ts`.
 *
 * バス rather than カタカナ for the katakana row: the claim is that katakana's
 * job is foreign words, so the example has to be a loanword.
 */
const SCRIPT_ROWS = [
  {
    slug: 'hiragana',
    label: 'Hiragana',
    job: 'The glue — word endings, particles, and words with no kanji.',
  },
  {
    slug: 'basu',
    label: 'Katakana',
    job: 'Words borrowed from other languages, in their own angular shapes.',
  },
  {
    slug: 'nihongo',
    label: 'Kanji',
    job: 'Whole ideas in one character, so meaning lands at a glance.',
  },
] as const;

export function ThreeScriptsCard() {
  const { curriculumDb } = useDatabase();

  // Fixed row set, so one lookup pass per database handle — not per render.
  const rows = useMemo(
    () =>
      SCRIPT_ROWS.map((row) => ({
        ...row,
        item: getItemBySlug(curriculumDb, 'vocabulary', row.slug),
      })),
    [curriculumDb],
  );

  return (
    <View className="gap-space-sm" testID="three-scripts-card">
      <Text className="text-body font-ui text-secondary">
        Japanese is written in three scripts at once. Each one has a different job, and you will see
        all three in your first lesson.
      </Text>

      {rows.map(({ slug, label, job, item }) =>
        item ? (
          <View
            key={slug}
            className="gap-space-xs rounded-radius-lg border border-border bg-surface p-space-lg"
            testID={`three-scripts-row-${slug}`}>
            <View className="flex-row items-end justify-between gap-space-sm">
              <FuriganaText
                text={item.furigana ?? item.primaryForm}
                mode="shown"
                className="font-jp text-title text-primary"
              />
              <Text className="text-body-sm font-ui-bold uppercase text-muted">{label}</Text>
            </View>
            <Text
              className="text-body font-ui-medium text-primary"
              testID={`three-scripts-meaning-${slug}`}>
              {item.meaning}
            </Text>
            <Text className="text-body-sm font-ui text-muted">{job}</Text>
          </View>
        ) : null,
      )}
    </View>
  );
}
