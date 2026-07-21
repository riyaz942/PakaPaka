import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { ConversationMode } from '@/core/ai/aiSession.types';
import type { RecentGrammarItem } from '@/data/ai/recentGrammarRepository';

type StartOption = {
  mode: ConversationMode;
  title: string;
  description: string;
};

const OPTIONS: StartOption[] = [
  {
    mode: 'practise_recent_grammar',
    title: 'Practise recent grammar',
    description: 'A scene built around the grammar you studied most recently.',
  },
  {
    mode: 'choose_grammar',
    title: 'Choose grammar',
    description: 'Pick the point you want to drill.',
  },
  {
    mode: 'role_play',
    title: 'Role-play',
    description: 'A short everyday scene with a character.',
  },
  {
    mode: 'random',
    title: 'Surprise me',
    description: 'A light topic chosen for you.',
  },
];

type ConversationStartPickerProps = {
  recentGrammar: RecentGrammarItem[];
  onStart: (mode: ConversationMode) => void;
  disabled?: boolean;
};

/**
 * The Conversation tab's primary empty state (FR89, UX-DR21) — the four ways
 * to start. Past threads live behind the header entry point, deliberately
 * secondary to starting something new.
 */
export function ConversationStartPicker({
  recentGrammar,
  onStart,
  disabled = false,
}: ConversationStartPickerProps) {
  return (
    <ScrollView className="flex-1" contentContainerClassName="p-space-lg">
      <Text accessibilityRole="header" className="text-title-lg text-primary">
        Start a conversation
      </Text>
      <Text className="mt-space-sm text-body text-secondary">
        Chat in Japanese. Nothing is corrected while you talk — you get notes once you finish.
      </Text>

      <View className="mt-space-lg gap-space-sm">
        {OPTIONS.map((option) => {
          const subtitle =
            option.mode === 'practise_recent_grammar' && recentGrammar.length > 0
              ? recentGrammar.map((item) => item.primaryForm).join('、')
              : option.description;

          return (
            <Pressable
              key={option.mode}
              accessibilityRole="button"
              accessibilityLabel={`${option.title}. ${subtitle}`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => onStart(option.mode)}
              testID={`start-${option.mode}`}
              className="min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-space-md">
              <Text className="text-body font-semibold text-primary">{option.title}</Text>
              <Text className="mt-space-xs text-body-sm text-secondary">{subtitle}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
