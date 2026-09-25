import React from 'react';
import { Text, View } from 'react-native';

import { FuriganaText } from '@/components/common/FuriganaText';
import { SectionHeading } from '@/components/common/SectionHeading';
import type { GrammarUse } from '@/data/curriculum/itemRepository';
import { useFuriganaPreference } from '@/data/hooks/useFuriganaPreference';

/**
 * A grammar point that does more than one job (e.g. もの: nostalgic habit and
 * emotional reason) lists each use with its own pattern and one example, in
 * place of the single Structure line. Shared by the lesson intro and the
 * details scroll.
 */
export function GrammarUsesSection({ uses }: { uses: GrammarUse[] }) {
  const { mode, knownKanji } = useFuriganaPreference();

  return (
    <View className="mt-4" testID="grammar-uses">
      <SectionHeading label={`${uses.length} uses`} />
      <View className="mt-space-sm gap-space-sm">
        {uses.map((use, index) => (
          <View
            key={index}
            className="rounded-radius-md bg-content-grammar-soft px-space-md py-space-sm"
            testID={`grammar-use-${index}`}>
            <Text className="text-body-sm font-ui-bold text-content-grammar-deep">
              {index + 1}. {use.label}
            </Text>
            <Text className="mt-space-xs text-body font-jp-medium text-primary">
              {use.structure}
            </Text>
            <FuriganaText
              text={use.furigana ?? use.japanese}
              mode={mode}
              knownKanji={knownKanji}
              className="mt-space-sm text-body-lg font-jp-medium text-primary"
            />
            <Text className="mt-[3px] text-body-sm font-ui text-muted">{use.english}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
