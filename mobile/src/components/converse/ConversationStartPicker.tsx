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
  /** Single chosen topic id — the one `choose_grammar` picked. */
  topicItemId?: string | null;
  /**
   * Every grammar item the session should be grounded in. Persisted with the
   * session so a resume replays this exact set instead of re-deriving it.
   */
  topicItemIds?: string[];
};

type ConversationStartPickerProps = {
  recentGrammar: RecentGrammarItem[];
  /** Full grammar list for the choose-grammar sheet. */
  allGrammar: RecentGrammarItem[];
  /**
   * True when the grammar read failed rather than returning nothing. An empty
   * list and a broken database must not read the same to the learner.
   */
  grammarLoadFailed?: boolean;
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
  grammarLoadFailed = false,
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
      // Pin the whole set: the prompt is grounded in all of it, so persisting
      // only the first id would let a resume re-derive a different scene.
      onStart({
        mode,
        topicItemId: recentGrammar[0]?.itemId ?? null,
        topicItemIds: recentGrammar.map((item) => item.itemId),
      });
      return;
    }
    onStart({ mode });
  }

  function handleChoose(item: RecentGrammarItem) {
    setChoosingGrammar(false);
    onStart({
      mode: 'choose_grammar',
      topicItemId: item.itemId,
      topicItemIds: [item.itemId],
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

        {grammarLoadFailed ? (
          <Text
            accessibilityLiveRegion="polite"
            className="mt-space-md text-body-sm text-feedback-incorrect">
            Could not load your grammar, so the grammar-based options are unavailable. The other
            ways to start still work.
          </Text>
        ) : null}

        <View className="mt-space-lg gap-space-sm">
          {OPTIONS.map((option) => {
            // A grammar option with nothing to ground it would start a generic
            // chat under a grammar label, so it is offered only when it can
            // deliver what its title promises.
            const unavailableReason =
              option.mode === 'practise_recent_grammar' && recentGrammar.length === 0
                ? grammarLoadFailed
                  ? 'Unavailable — your grammar could not be loaded.'
                  : 'Available once you have studied some grammar.'
                : option.mode === 'choose_grammar' && allGrammar.length === 0
                  ? grammarLoadFailed
                    ? 'Unavailable — your grammar could not be loaded.'
                    : 'Available once your curriculum has grammar to pick from.'
                  : null;

            const subtitle =
              unavailableReason ??
              (option.mode === 'practise_recent_grammar' && recentGrammar.length > 0
                ? recentGrammar.map((item) => item.primaryForm).join('、')
                : option.description);

            const isDisabled = disabled || unavailableReason !== null;

            return (
              <Pressable
                key={option.mode}
                accessibilityRole="button"
                accessibilityLabel={`${option.title}. ${subtitle}`}
                accessibilityState={{ disabled: isDisabled }}
                disabled={isDisabled}
                onPress={() => handleOption(option.mode)}
                testID={`start-${option.mode}`}
                className={`min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-space-md ${
                  isDisabled ? 'opacity-50' : ''
                }`}>
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

            {/* The option that opens this sheet is disabled while the list is
                empty, so there is no empty state to render here. */}
            <ScrollView className="mt-space-md">
              <View className="gap-space-sm">
                {allGrammar.map((item) => (
                  <Pressable
                    key={item.itemId}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.primaryForm}. ${item.meaning}`}
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    onPress={() => handleChoose(item)}
                    testID={`choose-grammar-${item.itemId}`}
                    className="min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-space-md">
                    <Text className="text-body font-semibold text-primary">{item.primaryForm}</Text>
                    <Text className="mt-space-xs text-body-sm text-secondary">{item.meaning}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

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
