import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import type { ConversationMode } from '@/core/ai/aiSession.types';
import type { RecentGrammarItem } from '@/data/ai/recentGrammarRepository';
import { cn } from '@/utils/cn';

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
  const highlighted = recentGrammar[0] ?? null;

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
      <ScrollView className="flex-1" contentContainerClassName="px-space-md pb-space-lg">
        <Text
          accessibilityRole="header"
          className="mt-space-md text-title font-ui-extrabold text-primary">
          Start a conversation
        </Text>
        <Text className="mt-space-sm text-label font-ui text-muted">
          Chat in Japanese. Nothing is corrected while you talk — you get notes once you finish.
        </Text>

        {grammarLoadFailed ? (
          <Text
            accessibilityLiveRegion="polite"
            className="mt-space-md text-body-sm font-ui text-feedback-incorrect-deep">
            Could not load your grammar, so the grammar-based options are unavailable. The other
            ways to start still work.
          </Text>
        ) : null}

        <View className="mt-space-md gap-[9px]">
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

            const isHighlighted =
              option.mode === 'practise_recent_grammar' && unavailableReason === null && highlighted;

            const subtitle =
              unavailableReason ??
              (isHighlighted
                ? `${highlighted.primaryForm} · ${highlighted.meaning}`
                : option.description);

            const isDisabled = disabled || unavailableReason !== null;
            // Spec draws the first character in the soft glyph square; longer
            // forms (て形) still fit as a single lead character.
            const glyph = highlighted?.primaryForm.trim().charAt(0) || 'は';

            return (
              <Pressable
                key={option.mode}
                accessibilityRole="button"
                accessibilityLabel={`${option.title}. ${subtitle}`}
                accessibilityState={{ disabled: isDisabled }}
                disabled={isDisabled}
                onPress={() => handleOption(option.mode)}
                testID={`start-${option.mode}`}
                className={cn(
                  'min-h-[44px] flex-row items-center gap-space-md rounded-radius-lg bg-surface px-space-md py-space-md shadow-e1',
                  isHighlighted
                    ? 'border-2 border-content-grammar'
                    : 'border border-border',
                  isDisabled && 'opacity-50',
                )}>
                {isHighlighted ? (
                  <View className="h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-content-grammar-soft">
                    <Text className="text-title font-jp-round-black text-content-grammar-deep">
                      {glyph}
                    </Text>
                  </View>
                ) : null}
                <View className="flex-1">
                  <Text className="text-body font-ui-extrabold text-primary">{option.title}</Text>
                  <Text className="mt-space-xs text-caption font-ui-medium text-muted">
                    {subtitle}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-space-md flex-row items-center gap-space-sm rounded-radius-md bg-surface-elevated px-space-md py-[11px]">
          <Icon name="locked" size={16} strokeWidth={2} className="text-muted" />
          <Text className="flex-1 text-caption font-ui-medium text-muted">
            Only online feature — key in secure storage, transcripts on-device.
          </Text>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={choosingGrammar}
        onRequestClose={() => setChoosingGrammar(false)}
        accessibilityViewIsModal>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[75%] gap-space-md rounded-t-radius-xl border-t border-border bg-surface px-space-lg pb-space-2xl pt-space-lg shadow-e3">
            <View className="h-1 w-10 self-center rounded-radius-full bg-border" />
            <Text accessibilityRole="header" className="text-title font-ui-bold text-primary">
              Choose grammar
            </Text>
            <Text className="text-body-sm font-ui text-secondary">
              Pick the point you want this conversation to practise.
            </Text>

            {/* The option that opens this sheet is disabled while the list is
                empty, so there is no empty state to render here. */}
            <ScrollView>
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
                    className="min-h-[44px] rounded-radius-lg border border-border bg-surface px-space-md py-space-md shadow-e1">
                    <Text className="text-body font-ui-extrabold text-primary">
                      {item.primaryForm}
                    </Text>
                    <Text className="mt-space-xs text-caption font-ui-medium text-muted">
                      {item.meaning}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Button
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
