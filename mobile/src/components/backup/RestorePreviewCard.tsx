import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { SectionHeading } from '@/components/common/SectionHeading';
import type { BackupPreview } from '@/core/backup/backup.types';

export type RestorePreviewCardState = 'reading' | 'loading' | 'summary' | 'error';

type RestorePreviewCardProps = {
  state: RestorePreviewCardState;
  preview?: BackupPreview;
  errorMessage?: string;
  /** Signed in: the restore also replaces the progress on the other devices. */
  signedIn?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Deliberately not `ImportSummaryCard`: that card is labelled by
 * `ImportSource` and talks in mapped/burned/apprentice counts. A restore
 * replaces everything, so the headline fact is the warning, not the mapping.
 */
export const RESTORE_CONFIRM_WARNING = 'This replaces your current progress on this device.';
const RESTORE_CONFIRM_WARNING_SIGNED_IN =
  'This replaces the progress on all your signed-in devices.';

function formatExportedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function SummaryContent({
  preview,
  signedIn,
  onConfirm,
  onCancel,
}: {
  preview: BackupPreview;
  signedIn: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { summary, unmatchedSlugs } = preview;

  return (
    <View className="gap-space-lg">
      <View accessibilityRole="summary" testID="restore-preview-region" className="gap-space-md">
        <View>
          <SectionHeading label="This backup" />
          <Text
            accessibilityLabel={`${summary.itemCount} rows saved on ${formatExportedAt(summary.exportedAt)}`}
            className="mt-space-xs text-body font-ui-semibold text-primary"
            testID="restore-preview-item-count">
            {summary.itemCount} {summary.itemCount === 1 ? 'row' : 'rows'} · backed up{' '}
            {formatExportedAt(summary.exportedAt)}
          </Text>
          <Text className="mt-space-xs text-body-sm font-ui text-secondary">
            {summary.includesConversations
              ? 'Includes AI conversations.'
              : 'No AI conversations in this file.'}
          </Text>
        </View>

        <View>
          <SectionHeading label={`Unmatched items (${summary.unmatchedSlugCount})`} />
          {unmatchedSlugs.length === 0 ? (
            <Text
              accessibilityLabel="All items matched"
              className="mt-space-xs text-body-sm font-ui text-secondary"
              testID="restore-preview-all-matched">
              All items matched
            </Text>
          ) : (
            <ScrollView
              accessibilityLabel={`${unmatchedSlugs.length} unmatched items`}
              className="mt-space-sm max-h-40 rounded-radius-sm border border-border bg-surface"
              nestedScrollEnabled
              testID="restore-preview-unmatched-list">
              {unmatchedSlugs.map((slug) => (
                <Text
                  key={slug}
                  className="border-b border-border px-space-md py-space-sm text-body-sm font-ui text-secondary">
                  {slug}
                </Text>
              ))}
            </ScrollView>
          )}
          {summary.unmatchedSlugCount > 0 ? (
            <Text className="mt-space-xs text-body-sm font-ui text-secondary">
              These are no longer in the curriculum on this device and will be skipped.
            </Text>
          ) : null}
        </View>

        {summary.unmatchedPassageCount > 0 ? (
          <Text
            className="text-body-sm font-ui text-secondary"
            testID="restore-preview-unmatched-passages">
            {summary.unmatchedPassageCount} reading{' '}
            {summary.unmatchedPassageCount === 1 ? 'answer' : 'answers'} point at passages this
            device does not have and will be skipped.
          </Text>
        ) : null}

        <View className="flex-row items-start gap-space-sm rounded-radius-md bg-feedback-warning-soft px-space-md py-space-sm">
          <Icon name="info" size={20} strokeWidth={2} className="text-feedback-warning-deep" />
          <Text
            accessibilityRole="alert"
            className="flex-1 text-body-sm font-ui-semibold text-feedback-warning-deep"
            testID="restore-preview-warning">
            {signedIn ? RESTORE_CONFIRM_WARNING_SIGNED_IN : RESTORE_CONFIRM_WARNING}
          </Text>
        </View>

        <Text className="text-body-sm font-ui text-secondary">
          Your saved API keys stay on this device — a backup never contains them.
        </Text>
      </View>

      <View className="gap-space-sm">
        <Button
          label="Replace my progress"
          variant="destructive"
          onPress={onConfirm}
          testID="restore-preview-confirm"
        />
        <Button label="Cancel" variant="secondary" onPress={onCancel} testID="restore-preview-cancel" />
      </View>
    </View>
  );
}

export function RestorePreviewCard({
  state,
  preview,
  errorMessage,
  signedIn = false,
  onConfirm,
  onCancel,
}: RestorePreviewCardProps) {
  return (
    <View
      className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1"
      testID="restore-preview-card">
      {state === 'reading' || state === 'loading' ? (
        <View className="items-center gap-space-md py-space-xl">
          <ActivityIndicator
            accessibilityLabel={
              state === 'reading' ? 'Reading your backup' : 'Restoring your backup'
            }
          />
          <Text className="text-body-sm font-ui-medium text-secondary">
            {state === 'reading' ? 'Reading backup…' : 'Restoring…'}
          </Text>
        </View>
      ) : null}

      {state === 'error' && errorMessage ? (
        <View className="gap-space-md">
          <View className="flex-row items-start gap-space-sm rounded-radius-md bg-feedback-incorrect-soft px-space-md py-space-sm">
            <Icon name="info" size={20} strokeWidth={2} className="text-feedback-incorrect-deep" />
            <Text
              accessibilityRole="alert"
              className="flex-1 text-body-sm font-ui-semibold text-feedback-incorrect-deep"
              testID="restore-preview-error">
              {errorMessage}
            </Text>
          </View>
          <Button label="Close" variant="secondary" onPress={onCancel} testID="restore-preview-dismiss" />
        </View>
      ) : null}

      {state === 'summary' && preview ? (
        <SummaryContent
          preview={preview}
          signedIn={signedIn}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      ) : null}
    </View>
  );
}
