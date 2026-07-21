import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
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

export type ConversationStartRequest = {
  mode: ConversationMode;
  /** Grammar grounding for practise-recent / choose-grammar. */
  grammarTopics?: RecentGrammarItem[];
  /** Single chosen topic id for choose_grammar persistence. */
  topicItemId?: string | null;
};

type ConversationStartPickerProps = {
  recentGrammar: RecentGrammarItem[];
  /** Full grammar list for the choose-grammar sheet. */
  allGrammar: RecentGrammarItem[];
  onStart: (request: ConversationStartRequest) => void;
  disabled?: boolean;
};

/**
 * The Conversation tab's primary empty state (FR89, UX-DR21) — the four ways
 * to start. Past threads live behind the header entry point, deliberately
 * secondary to starting something new.
 */
export function ConversationStartPicker({
  recentGrammar,
  allGrammar,
  onStart,
  disabled = false,
}: ConversationStartPickerProps) {
  const [choosingGrammar, setChoosingGrammar] = useState(false);

  function handleOption(mode: ConversationMode) {
    if (mode === 'choose_grammar') {
      setChoosingGrammar(true);
      return;
    }
    if (mode === 'practise_recent_grammar') {
      onStart({
        mode,
        grammarTopics: recentGrammar,
        topicItemId: recentGrammar[0]?.itemId ?? null,
      });
      return;
    }
    onStart({ mode });
  }

  function handleChoose(item: RecentGrammarItem) {
    setChoosingGrammar(false);
    onStart({
      mode: 'choose_grammar',
      grammarTopics: [item],
      topicItemId: item.itemId,
    });
  }

  return (
    <>
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
                onPress={() => handleOption(option.mode)}
                testID={`start-${option.mode}`}
                className="min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-space-md">
                <Text className="text-body font-semibold text-primary">{option.title}</Text>
                <Text className="mt-space-xs text-body-sm text-secondary">{subtitle}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={choosingGrammar}
        onRequestClose={() => setChoosingGrammar(false)}
        accessibilityViewIsModal>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[75%] rounded-t-radius-lg border-t border-border bg-background p-space-lg">
            <Text accessibilityRole="header" className="text-title text-primary">
              Choose grammar
            </Text>
            <Text className="mt-space-sm text-body-sm text-secondary">
              Pick the point you want this conversation to practise.
            </Text>

            {allGrammar.length === 0 ? (
              <Text className="mt-space-md text-body text-secondary">
                No grammar items are available yet.
              </Text>
            ) : (
              <ScrollView className="mt-space-md">
                <View className="gap-space-sm">
                  {allGrammar.map((item) => (
                    <Pressable
                      key={item.itemId}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.primaryForm}. ${item.meaning}`}
                      disabled={disabled}
                      onPress={() => handleChoose(item)}
                      testID={`choose-grammar-${item.itemId}`}
                      className="min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-space-md">
                      <Text className="text-body font-semibold text-primary">
                        {item.primaryForm}
                      </Text>
                      <Text className="mt-space-xs text-body-sm text-secondary">
                        {item.meaning}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}

            <Button
              className="mt-space-lg"
              label="Cancel"
              onPress={() => setChoosingGrammar(false)}
              variant="ghost"
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
