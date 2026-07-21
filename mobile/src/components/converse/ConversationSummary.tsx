import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
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
        <Text className="mt-space-md text-body text-secondary">Looking over your conversation…</Text>
      </View>
    );
  }

  if (!summary) {
    return (
      <View className="flex-1 justify-center p-space-lg">
        <Text accessibilityRole="header" className="text-title text-primary">
          Session finished
        </Text>
        <Text className="mt-space-sm text-body text-secondary">
          Want notes on how it went? That takes one more request to your provider.
        </Text>
        {error ? (
          <Text accessibilityLiveRegion="polite" className="mt-space-md text-body text-feedback-error">
            {error.userMessage ?? error.message}
          </Text>
        ) : null}
        <Button className="mt-space-lg" label="Get my notes" onPress={onGenerate} testID="summary-generate" />
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
      <Text accessibilityRole="header" className="text-title-lg text-primary">
        How that went
      </Text>

      <Text accessibilityRole="header" className="mt-space-lg text-title text-primary">
        Worth fixing
      </Text>
      {summary.mistakes.length === 0 ? (
        <Text className="mt-space-sm text-body text-secondary">
          Nothing worth correcting — nice work.
        </Text>
      ) : (
        <View className="mt-space-sm gap-space-sm">
          {summary.mistakes.map((mistake, index) => (
            <View
              key={`${mistake.correction}-${index}`}
              className="rounded-radius-md border border-border bg-surface p-space-md">
              <Text className="text-body text-secondary line-through">{mistake.quote}</Text>
              <Text className="mt-space-xs text-body font-semibold text-primary">
                {mistake.correction}
              </Text>
              {mistake.note ? (
                <Text className="mt-space-xs text-body-sm text-secondary">{mistake.note}</Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <Text accessibilityRole="header" className="mt-space-lg text-title text-primary">
        Words you met
      </Text>
      {summary.wordsMet.length === 0 ? (
        <Text className="mt-space-sm text-body text-secondary">No new words came up.</Text>
      ) : (
        <View className="mt-space-sm flex-row flex-wrap gap-space-sm">
          {summary.wordsMet.map((word) =>
            word.itemId ? (
              <Pressable
                key={word.text}
                accessibilityRole="button"
                accessibilityLabel={`Open details for ${word.text}`}
                onPress={() => router.push(`/browse/item/${word.itemId}`)}
                className="min-h-[44px] justify-center rounded-radius-md border border-feedback-info bg-surface px-space-md py-space-sm">
                <Text className="text-body text-feedback-info">{word.text}</Text>
              </Pressable>
            ) : (
              // Off-curriculum: shown for reference, not linked, never an SRS row.
              <View
                key={word.text}
                className="min-h-[44px] justify-center rounded-radius-md border border-border bg-surface px-space-md py-space-sm">
                <Text className="text-body text-secondary">{word.text}</Text>
              </View>
            ),
          )}
        </View>
      )}

      {summary.grammarNotes.length > 0 ? (
        <>
          <Text accessibilityRole="header" className="mt-space-lg text-title text-primary">
            Grammar you practised
          </Text>
          <View className="mt-space-sm gap-space-xs">
            {summary.grammarNotes.map((note, index) => (
              <Text key={`${note}-${index}`} className="text-body text-secondary">
                • {note}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      {isCached ? (
        <Text className="mt-space-lg text-body-sm text-secondary">
          Saved with this conversation — reopening it will not spend another request.
        </Text>
      ) : null}

      <Button
        className="mt-space-lg"
        label="Done"
        onPress={() => router.dismissAll()}
        variant="secondary"
      />
    </ScrollView>
  );
}
