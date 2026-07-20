import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';

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
  return (
    <View className="flex-row items-center gap-space-sm rounded-radius-md border border-border bg-surface px-space-md">
      <MaterialIcons name="search" size={20} className="text-secondary" />
      <TextInput
        accessibilityLabel="Search radicals, kanji, vocabulary, grammar and passages"
        placeholder="Search anything"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        testID={testID}
        className="min-h-[44px] flex-1 text-body text-primary"
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          testID={testID ? `${testID}-clear` : undefined}
          className="min-h-[44px] min-w-[44px] items-center justify-center">
          <MaterialIcons name="close" size={20} className="text-secondary" />
        </Pressable>
      ) : null}
    </View>
  );
}
