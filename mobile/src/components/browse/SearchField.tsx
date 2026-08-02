import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { getSemanticColors } from '@/constants/semantic-colors';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  testID?: string;
};

/**
 * Browse search input (FR65).
 *
 * Deliberately *not* a `WanaKanaInput`: the review screen rewrites romaji to
 * kana as you type, but here the raw text has to survive, because "mizu" may be
 * romaji for みず and an English meaning at the same time. Kana conversion
 * happens downstream as extra query branches, never in this field.
 */
export function SearchField({ value, onChangeText, testID }: SearchFieldProps) {
  const colors = getSemanticColors(usePaintedColorScheme());

  return (
    <View className="flex-row items-center gap-space-sm rounded-radius-full border border-border bg-surface-elevated px-space-md">
      <Icon name="search" size={19} strokeWidth={2} className="text-muted" />
      <TextInput
        accessibilityLabel="Search radicals, kanji, vocabulary, grammar and passages"
        placeholder="Search anything"
        placeholderTextColor={colors.faint}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        testID={testID}
        className="min-h-[44px] flex-1 text-body font-ui-medium text-primary"
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          testID={testID ? `${testID}-clear` : undefined}
          className="min-h-[44px] min-w-[44px] items-center justify-center">
          <Icon name="close" size={18} strokeWidth={2} className="text-muted" />
        </Pressable>
      ) : null}
    </View>
  );
}
