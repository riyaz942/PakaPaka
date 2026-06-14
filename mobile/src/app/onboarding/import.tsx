import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { useDatabase } from '@/data/hooks/useDatabase';
import { saveImportCredential } from '@/data/user/credentialStore';
import { runWaniKaniImport } from '@/data/user/importRepository';

function getImportErrorMessage(error: { userMessage?: string; message: string }): string {
  return error.userMessage ?? error.message;
}

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const { curriculumDb, userDb } = useDatabase();
  const [apiKey, setApiKey] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleImportPress() {
    setStatusMessage(null);
    setIsImporting(true);

    try {
      const saveResult = await saveImportCredential('wanikani', apiKey);
      if (!saveResult.ok) {
        setStatusMessage(getImportErrorMessage(saveResult.error));
        return;
      }

      const importResult = await runWaniKaniImport(userDb, curriculumDb);
      if (!importResult.ok) {
        setStatusMessage(getImportErrorMessage(importResult.error));
        return;
      }

      setStatusMessage(
        `Imported ${importResult.value.mappedCount} mapped items (${importResult.value.unmatchedCount} unmatched).`,
      );
      setApiKey('');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }}>
      <Text accessibilityRole="header" className="text-title-lg text-primary">
        Import my progress
      </Text>
      <Text className="mt-4 text-body text-secondary">
        Import from WaniKani maps your assignments to this app&apos;s curriculum and converts SRS
        stages to FSRS. Your API key stays in secure storage only for the import and is removed
        after a successful import.
      </Text>

      <Text className="mt-8 text-body font-semibold text-primary">WaniKani API key</Text>
      <TextInput
        accessibilityLabel="WaniKani API key"
        autoCapitalize="none"
        autoCorrect={false}
        className="mt-2 rounded-radius-md border border-border bg-surface px-4 py-3 text-body text-primary"
        editable={!isImporting}
        onChangeText={setApiKey}
        placeholder="Paste your WaniKani v2 API key"
        placeholderTextColor="#8A8A8A"
        secureTextEntry
        value={apiKey}
      />

      {statusMessage ? (
        <Text accessibilityLiveRegion="polite" className="mt-4 text-body text-secondary">
          {statusMessage}
        </Text>
      ) : null}

      {isImporting ? (
        <View className="mt-6 items-center">
          <ActivityIndicator accessibilityLabel="Importing WaniKani progress" />
        </View>
      ) : null}

      <View className="mt-auto gap-3">
        <Button
          disabled={isImporting || apiKey.trim().length === 0}
          label="Import from WaniKani"
          onPress={handleImportPress}
        />
        <Button label="Back" onPress={() => router.back()} variant="secondary" />
      </View>
    </View>
  );
}
