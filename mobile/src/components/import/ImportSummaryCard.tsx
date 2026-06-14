import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import type { ImportPreview, ImportSource } from '@/core/import/import.types';

export type ImportSummaryCardState = 'loading' | 'summary' | 'confirmed' | 'error';

type ImportSummaryCardProps = {
  state: ImportSummaryCardState;
  preview?: ImportPreview;
  errorMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
};

const SOURCE_LABELS: Record<ImportSource, string> = {
  wanikani: 'WaniKani',
  bunpro: 'Bunpro',
  anki: 'Anki',
};

function SourceBadge({ source }: { source: ImportSource }) {
  return (
    <View className="self-start rounded-radius-md border border-border bg-surface px-3 py-1">
      <Text className="text-body-sm font-semibold text-primary">{SOURCE_LABELS[source]}</Text>
    </View>
  );
}

function LoadingContent() {
  return (
    <View className="items-center gap-4 py-8">
      <ActivityIndicator accessibilityLabel="Loading import preview" />
      <Text className="text-body text-secondary">Fetching and mapping your progress...</Text>
    </View>
  );
}

function ErrorContent({
  errorMessage,
  onRetry,
  onCancel,
}: {
  errorMessage: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="gap-4">
      <Text accessibilityRole="alert" className="text-body text-secondary">
        {errorMessage}
      </Text>
      <View className="gap-3">
        <Button label="Retry" onPress={onRetry} />
        <Button label="Back to import" onPress={onCancel} variant="secondary" />
      </View>
    </View>
  );
}

function ConfirmedContent({ preview }: { preview: ImportPreview }) {
  const total = preview.summary.mappedCount + preview.summary.unmatchedCount;

  return (
    <View className="gap-4">
      <View
        accessibilityRole="text"
        className="flex-row items-center gap-2 rounded-radius-md border border-feedback-correct bg-feedback-correct/10 px-4 py-3">
        <Text className="text-body font-semibold text-feedback-correct">✓</Text>
        <Text
          accessibilityLabel={`Import confirmed. ${preview.summary.mappedCount} of ${total} items imported.`}
          className="flex-1 text-body font-semibold text-feedback-correct">
          Import confirmed — {preview.summary.mappedCount} of {total} items saved
        </Text>
      </View>
    </View>
  );
}

function SummaryContent({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { summary, unmatched } = preview;
  const total = summary.mappedCount + summary.unmatchedCount;

  return (
    <View className="gap-6">
      <View accessibilityRole="summary" testID="import-summary-region" className="gap-4">
        <SourceBadge source={preview.source} />

        <View>
          <Text className="text-body font-semibold text-primary">Import results</Text>
          <Text
            accessibilityLabel={`Mapped ${summary.mappedCount} of ${total} items`}
            className="mt-1 text-body text-secondary">
            Mapped {summary.mappedCount} of {total}
          </Text>
        </View>

        <View>
          <Text className="text-body font-semibold text-primary">SRS stage mapping</Text>
          <Text
            accessibilityLabel={`${summary.burnedCount} burned items stay burned`}
            className="mt-2 text-body text-secondary">
            Burned items stay burned ({summary.burnedCount})
          </Text>
          <Text
            accessibilityLabel={`${summary.apprenticeCount} apprentice items enter at short intervals`}
            className="mt-1 text-body text-secondary">
            Apprentice items enter at short intervals ({summary.apprenticeCount})
          </Text>
        </View>

        {summary.warningMessage ? (
          <Text
            accessibilityRole="alert"
            accessibilityLabel={`Warning: ${summary.warningMessage}`}
            className="text-body text-secondary">
            {summary.warningMessage}
          </Text>
        ) : null}

        <View>
          <Text className="text-body font-semibold text-primary">
            Unmatched items ({summary.unmatchedCount})
          </Text>
          {unmatched.length === 0 ? (
            <Text
              accessibilityLabel="All items matched"
              className="mt-2 text-body text-secondary">
              All items matched
            </Text>
          ) : (
            <ScrollView
              accessibilityLabel={`${unmatched.length} unmatched items`}
              className="mt-2 max-h-40 rounded-radius-md border border-border bg-surface"
              nestedScrollEnabled>
              {unmatched.map((item) => (
                <Text
                  key={item.externalId}
                  accessibilityLabel={`Unmatched item ${item.externalId}, stage ${item.srsStageName}`}
                  className="border-b border-border px-4 py-2 text-body text-secondary">
                  {item.externalId}
                </Text>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View className="gap-3">
        <Button label="Confirm import" onPress={onConfirm} />
        <Button label="Re-import" onPress={onCancel} variant="secondary" />
      </View>
    </View>
  );
}

export function ImportSummaryCard({
  state,
  preview,
  errorMessage,
  onConfirm,
  onCancel,
  onRetry,
}: ImportSummaryCardProps) {
  return (
    <View className="rounded-radius-md border border-border bg-surface-elevated p-4">
      {state === 'loading' ? <LoadingContent /> : null}
      {state === 'error' && errorMessage ? (
        <ErrorContent errorMessage={errorMessage} onCancel={onCancel} onRetry={onRetry} />
      ) : null}
      {state === 'confirmed' && preview ? <ConfirmedContent preview={preview} /> : null}
      {state === 'summary' && preview ? (
        <SummaryContent preview={preview} onCancel={onCancel} onConfirm={onConfirm} />
      ) : null}
    </View>
  );
}
