import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { SectionHeading } from '@/components/common/SectionHeading';
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
    <View className="self-start rounded-radius-full bg-brand-soft px-space-sm py-[3px]">
      <Text className="text-overline font-ui-bold uppercase tracking-[0.08em] text-brand-text">
        {SOURCE_LABELS[source]}
      </Text>
    </View>
  );
}

function LoadingContent() {
  return (
    <View className="items-center gap-space-md py-space-xl">
      <ActivityIndicator accessibilityLabel="Loading import preview" />
      <Text className="text-body-sm font-ui-medium text-secondary">
        Fetching and mapping your progress...
      </Text>
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
    <View className="gap-space-md">
      <View className="flex-row items-start gap-space-sm rounded-radius-md bg-feedback-incorrect-soft px-space-md py-space-sm">
        <Icon
          name="info"
          size={20}
          strokeWidth={2}
          className="text-feedback-incorrect-deep"
        />
        <Text
          accessibilityRole="alert"
          className="flex-1 text-body-sm font-ui-semibold text-feedback-incorrect-deep">
          {errorMessage}
        </Text>
      </View>
      <View className="gap-space-sm">
        <Button label="Retry" onPress={onRetry} />
        <Button label="Back to import" onPress={onCancel} variant="secondary" />
      </View>
    </View>
  );
}

function ConfirmedContent({ preview }: { preview: ImportPreview }) {
  const total = preview.summary.mappedCount + preview.summary.unmatchedCount;

  return (
    <View className="gap-space-md">
      <View
        accessibilityRole="text"
        className="flex-row items-center gap-space-sm rounded-radius-md bg-feedback-correct-soft px-space-md py-space-sm">
        <Icon
          name="correct"
          size={20}
          strokeWidth={2.4}
          className="text-feedback-correct-deep"
        />
        <Text
          accessibilityLabel={`Import confirmed. ${preview.summary.mappedCount} of ${total} items imported.`}
          className="flex-1 text-body-sm font-ui-semibold text-feedback-correct-deep">
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
    <View className="gap-space-lg">
      <View accessibilityRole="summary" testID="import-summary-region" className="gap-space-md">
        <SourceBadge source={preview.source} />

        <View>
          <SectionHeading label="Import results" />
          <Text
            accessibilityLabel={`Mapped ${summary.mappedCount} of ${total} items`}
            className="mt-space-xs text-body font-ui-semibold text-primary">
            Mapped {summary.mappedCount} of {total}
          </Text>
        </View>

        <View>
          <SectionHeading label="SRS stage mapping" />
          <Text
            accessibilityLabel={`${summary.burnedCount} burned items stay burned`}
            className="mt-space-xs text-body-sm font-ui text-secondary">
            Burned items stay burned ({summary.burnedCount})
          </Text>
          <Text
            accessibilityLabel={`${summary.apprenticeCount} apprentice items enter at short intervals`}
            className="mt-space-xs text-body-sm font-ui text-secondary">
            Apprentice items enter at short intervals ({summary.apprenticeCount})
          </Text>
        </View>

        {summary.warningMessage ? (
          <View className="flex-row items-start gap-space-sm rounded-radius-md bg-feedback-warning-soft px-space-md py-space-sm">
            <Icon
              name="info"
              size={20}
              strokeWidth={2}
              className="text-feedback-warning-deep"
            />
            <Text
              accessibilityRole="alert"
              accessibilityLabel={`Warning: ${summary.warningMessage}`}
              className="flex-1 text-body-sm font-ui-semibold text-feedback-warning-deep">
              {summary.warningMessage}
            </Text>
          </View>
        ) : null}

        <View>
          <SectionHeading label={`Unmatched items (${summary.unmatchedCount})`} />
          {unmatched.length === 0 ? (
            <Text
              accessibilityLabel="All items matched"
              className="mt-space-xs text-body-sm font-ui text-secondary">
              All items matched
            </Text>
          ) : (
            <ScrollView
              accessibilityLabel={`${unmatched.length} unmatched items`}
              className="mt-space-sm max-h-40 rounded-radius-sm border border-border bg-surface"
              nestedScrollEnabled>
              {unmatched.map((item) => (
                <Text
                  key={item.externalId}
                  accessibilityLabel={`Unmatched item ${item.externalId}, stage ${item.srsStageName}`}
                  className="border-b border-border px-space-md py-space-sm text-body-sm font-ui text-secondary">
                  {item.externalId}
                </Text>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View className="gap-space-sm">
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
    <View className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
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
