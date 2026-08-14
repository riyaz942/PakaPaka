import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  RestorePreviewCard,
  type RestorePreviewCardState,
} from '@/components/backup/RestorePreviewCard';
import { ImportSummaryCard, type ImportSummaryCardState } from '@/components/import/ImportSummaryCard';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  clearBackupPreview,
  clearImportPreview,
  getBackupPreview,
  getImportPreview,
} from '@/data/import/importPreviewStore';
import { confirmCredentialedImport } from '@/data/user/importRepository';
import { restoreBackup } from '@/data/user/restoreBackup';
import {
  getStartingJlptLevel,
  setOnboardingPath,
  setStartingJlptLevel,
} from '@/data/user/preferencesRepository';

function getImportErrorMessage(error: { userMessage?: string; message: string }): string {
  return error.userMessage ?? error.message;
}

/**
 * Restore branch (Story 9.2 AC8). A backup already answers intensity, level and
 * study status, so this path goes straight to `complete` — sending it through
 * `intensity` would re-ask answered questions and let placement overwrite the
 * restored progress. The WaniKani/Bunpro/Anki branch below is unchanged.
 */
function RestoreSummary() {
  const insets = useSafeAreaInsets();
  const { userDb } = useDatabase();
  const [preview] = useState(() => getBackupPreview());
  const [cardState, setCardState] = useState<RestorePreviewCardState>(() =>
    preview ? 'summary' : 'error',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    preview ? null : 'No backup preview available. Please pick the file again.',
  );

  const handleCancel = useCallback(() => {
    clearBackupPreview();
    router.back();
  }, []);

  const handleConfirm = useCallback(() => {
    if (!preview || cardState === 'loading') {
      return;
    }

    setCardState('loading');
    const result = restoreBackup(userDb, preview, 'onboarding');
    if (!result.ok) {
      setErrorMessage(getImportErrorMessage(result.error));
      setCardState('error');
      return;
    }

    clearBackupPreview();
    router.replace('/onboarding/complete?restored=1');
  }, [cardState, preview, userDb]);

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }}>
      <Text
        accessibilityRole="header"
        className="text-title-lg font-ui-extrabold tracking-[-0.01em] text-primary">
        Restore summary
      </Text>
      <Text className="mt-[9px] text-body-sm font-ui text-muted">
        Review what this backup contains before confirming. Nothing is written until you confirm.
      </Text>

      <View className="mt-space-lg">
        <RestorePreviewCard
          errorMessage={errorMessage ?? undefined}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          preview={preview ?? undefined}
          state={cardState}
        />
      </View>
    </View>
  );
}

function ImportSummary() {
  const insets = useSafeAreaInsets();
  const { userDb } = useDatabase();
  const [preview] = useState(() => getImportPreview());
  const [cardState, setCardState] = useState<ImportSummaryCardState>(() =>
    preview ? 'summary' : 'error',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    preview ? null : 'No import preview available. Please try importing again.',
  );

  const handleCancel = useCallback(() => {
    clearImportPreview();
    router.back();
  }, []);

  const handleRetry = useCallback(() => {
    clearImportPreview();
    router.back();
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!preview || cardState === 'loading' || cardState === 'confirmed') {
      return;
    }

    setCardState('loading');

    const confirmResult = await confirmCredentialedImport(userDb, preview);
    if (!confirmResult.ok) {
      setErrorMessage(getImportErrorMessage(confirmResult.error));
      setCardState('error');
      return;
    }

    clearImportPreview();
    setCardState('confirmed');
    setOnboardingPath(userDb, 'import');
    if (!getStartingJlptLevel(userDb)) {
      setStartingJlptLevel(userDb, 'N3');
    }
    router.replace('/onboarding/intensity');
  }, [cardState, preview, userDb]);

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }}>
      <Text
        accessibilityRole="header"
        className="text-title-lg font-ui-extrabold tracking-[-0.01em] text-primary">
        Import summary
      </Text>
      <Text className="mt-[9px] text-body-sm font-ui text-muted">
        Review what will be imported before confirming. Nothing is saved until you confirm.
      </Text>

      <View className="mt-space-lg">
        <ImportSummaryCard
          errorMessage={errorMessage ?? undefined}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          onRetry={handleRetry}
          preview={preview ?? undefined}
          state={cardState}
        />
      </View>
    </View>
  );
}

export default function ImportSummaryScreen() {
  // The preview store holds one or the other, never both.
  const [isRestore] = useState(() => getBackupPreview() !== null);
  return isRestore ? <RestoreSummary /> : <ImportSummary />;
}
