import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImportSummaryCard, type ImportSummaryCardState } from '@/components/import/ImportSummaryCard';
import { useDatabase } from '@/data/hooks/useDatabase';
import { clearImportPreview, getImportPreview } from '@/data/import/importPreviewStore';
import { confirmCredentialedImport } from '@/data/user/importRepository';
import {
  getStartingJlptLevel,
  setOnboardingPath,
  setStartingJlptLevel,
} from '@/data/user/preferencesRepository';

function getImportErrorMessage(error: { userMessage?: string; message: string }): string {
  return error.userMessage ?? error.message;
}

export default function ImportSummaryScreen() {
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
      <Text accessibilityRole="header" className="text-title-lg text-primary">
        Import summary
      </Text>
      <Text className="mt-4 text-body text-secondary">
        Review what will be imported before confirming. Nothing is saved until you confirm.
      </Text>

      <View className="mt-8">
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
