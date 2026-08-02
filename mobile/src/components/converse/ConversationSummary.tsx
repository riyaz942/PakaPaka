import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { SessionCompleteHeader } from '@/components/common/SessionCompleteHeader';
import type { SessionSummary } from '@/core/ai/aiSession.types';
import type { AppError } from '@/types/result.types';

type ConversationSummaryProps = {
  summary: SessionSummary | null;
  isCached: boolean;
  isGenerating: boolean;
  error: AppError | null;
  onGenerate: () => void;
};

/**
 * Post-session coaching (FR95, FR96).
 *
 * Generation is on demand and happens once — the generate affordance disappears
 * as soon as a summary is cached, because a second call would cost the learner
 * another request for a summary they already have.
 */
export function ConversationSummary({
  summary,
  isCached,
  isGenerating,
  error,
  onGenerate,
}: ConversationSummaryProps) {
  if (isGenerating) {
    return (
      <View className="flex-1 items-center justify-center p-space-lg">
        <ActivityIndicator accessibilityLabel="Generating your session summary" />
        <Text className="mt-space-md text-body font-ui text-secondary">
          Looking over your conversation…
        </Text>
      </View>
    );
  }

  if (!summary) {
    return (
      <View className="flex-1 justify-center p-space-lg">
        <SessionCompleteHeader title="Session finished" />
        <Text className="mt-space-md text-center text-body font-ui text-secondary">
          Want notes on how it went? That takes one more request to your provider.
        </Text>
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            className="mt-space-md text-center text-body font-ui text-feedback-incorrect-deep">
            {error.userMessage ?? error.message}
          </Text>
        ) : null}
        <Button
          className="mt-space-lg"
          label="Get my notes"
          onPress={onGenerate}
          testID="summary-generate"
        />
        <Button
          className="mt-space-sm"
          label="Skip"
          onPress={() => router.back()}
          variant="ghost"
        />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="p-space-lg">
      <SessionCompleteHeader title="How that went" />

      <Text className="mt-space-xl text-overline font-ui-bold text-faint">WORTH FIXING</Text>
      {summary.mistakes.length === 0 ? (
        <Text className="mt-space-sm text-body font-ui text-secondary">
          Nothing worth correcting — nice work.
        </Text>
      ) : (
        <View className="mt-space-sm gap-space-sm">
          {summary.mistakes.map((mistake, index) => (
            <View
              key={`${mistake.correction}-${index}`}
              className="rounded-radius-lg border border-border bg-feedback-incorrect-soft p-space-md">
              <Text className="text-body font-jp-medium text-secondary line-through">
                {mistake.quote}
              </Text>
              <Text className="mt-space-xs text-body font-jp-medium text-primary">
                {mistake.correction}
              </Text>
              {mistake.note ? (
                <Text className="mt-space-xs text-body-sm font-ui text-secondary">
                  {mistake.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <Text className="mt-space-xl text-overline font-ui-bold text-faint">WORDS YOU MET</Text>
      {summary.wordsMet.length === 0 ? (
        <Text className="mt-space-sm text-body font-ui text-secondary">No new words came up.</Text>
      ) : (
        <View className="mt-space-sm flex-row flex-wrap gap-space-sm">
          {summary.wordsMet.map((word) =>
            word.itemId ? (
              <Pressable
                key={word.text}
                accessibilityRole="button"
                accessibilityLabel={`Open details for ${word.text}`}
                onPress={() => router.push(`/browse/item/${word.itemId}`)}
                className="min-h-[44px] justify-center rounded-radius-sm bg-content-vocabulary-soft px-space-md py-space-sm">
                <Text className="text-body font-jp-medium text-content-vocabulary-deep">
                  {word.text}
                </Text>
              </Pressable>
            ) : (
              // Off-curriculum: shown for reference, not linked, never an SRS row.
              <View
                key={word.text}
                className="min-h-[44px] justify-center rounded-radius-sm border border-border bg-surface px-space-md py-space-sm">
                <Text className="text-body font-jp-medium text-secondary">{word.text}</Text>
              </View>
            ),
          )}
        </View>
      )}

      {summary.grammarNotes.length > 0 ? (
        <>
          <Text className="mt-space-xl text-overline font-ui-bold text-faint">
            GRAMMAR YOU PRACTISED
          </Text>
          <View className="mt-space-sm gap-space-sm">
            {summary.grammarNotes.map((note, index) => (
              <View
                key={`${note}-${index}`}
                className="rounded-radius-lg bg-content-grammar-soft px-space-md py-space-sm">
                <Text className="text-body font-ui text-content-grammar-deep">{note}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {isCached ? (
        <Text className="mt-space-lg text-body-sm font-ui text-muted">
          Saved with this conversation — reopening it will not spend another request.
        </Text>
      ) : null}

      <Button
        className="mt-space-lg"
        label="Done"
        onPress={() => router.dismissAll()}
      />
    </ScrollView>
  );
}
