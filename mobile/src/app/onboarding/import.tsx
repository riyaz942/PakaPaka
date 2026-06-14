import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import type { ImportSummary } from '@/core/import/import.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { saveImportCredential } from '@/data/user/credentialStore';
import { runBunproImport, runWaniKaniImport } from '@/data/user/importRepository';

type ImportSource = 'wanikani' | 'bunpro';

function getImportErrorMessage(error: { userMessage?: string; message: string }): string {
  return error.userMessage ?? error.message;
}

function formatBunproImportSuccessMessage(summary: ImportSummary): string {
  let message = `Imported ${summary.mappedCount} grammar points (${summary.unmatchedCount} unmatched).`;
  if (summary.warningMessage) {
    message += ` ${summary.warningMessage}`;
  }
  return message;
}

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const { curriculumDb, userDb } = useDatabase();
  const [selectedSource, setSelectedSource] = useState<ImportSource>('wanikani');
  const [wanikaniApiKey, setWanikaniApiKey] = useState('');
  const [bunproToken, setBunproToken] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleWaniKaniImportPress() {
    setStatusMessage(null);
    setIsImporting(true);

    try {
      const saveResult = await saveImportCredential('wanikani', wanikaniApiKey);
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
      setWanikaniApiKey('');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleBunproImportPress() {
    setStatusMessage(null);
    setIsImporting(true);

    try {
      const saveResult = await saveImportCredential('bunpro', bunproToken);
      if (!saveResult.ok) {
        setStatusMessage(getImportErrorMessage(saveResult.error));
        return;
      }

      const importResult = await runBunproImport(userDb, curriculumDb);
      if (!importResult.ok) {
        setStatusMessage(getImportErrorMessage(importResult.error));
        return;
      }

      setStatusMessage(formatBunproImportSuccessMessage(importResult.value));
      setBunproToken('');
    } finally {
      setIsImporting(false);
    }
  }

  function handleSourceChange(source: ImportSource) {
    setSelectedSource(source);
    setStatusMessage(null);
  }

  return (
    <View
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }}>
      <Text accessibilityRole="header" className="text-title-lg text-primary">
        Import my progress
      </Text>
      <Text className="mt-4 text-body text-secondary">
        Bring SRS progress from another study tool. Credentials stay in secure storage only for the
        import and are removed after a successful import.
      </Text>

      <View className="mt-6 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedSource === 'wanikani' }}
          className={`flex-1 rounded-radius-md border px-4 py-3 ${
            selectedSource === 'wanikani' ? 'border-primary bg-surface' : 'border-border'
          }`}
          disabled={isImporting}
          onPress={() => handleSourceChange('wanikani')}>
          <Text className="text-center text-body font-semibold text-primary">WaniKani</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedSource === 'bunpro' }}
          className={`flex-1 rounded-radius-md border px-4 py-3 ${
            selectedSource === 'bunpro' ? 'border-primary bg-surface' : 'border-border'
          }`}
          disabled={isImporting}
          onPress={() => handleSourceChange('bunpro')}>
          <Text className="text-center text-body font-semibold text-primary">Bunpro</Text>
        </Pressable>
      </View>

      {selectedSource === 'wanikani' ? (
        <View className="mt-8">
          <Text className="text-body font-semibold text-primary">WaniKani API key</Text>
          <Text className="mt-2 text-body text-secondary">
            Import from WaniKani maps your assignments to this app&apos;s curriculum and converts SRS
            stages to FSRS.
          </Text>
          <TextInput
            accessibilityLabel="WaniKani API key"
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-4 rounded-radius-md border border-border bg-surface px-4 py-3 text-body text-primary"
            editable={!isImporting}
            onChangeText={setWanikaniApiKey}
            placeholder="Paste your WaniKani v2 API key"
            placeholderTextColor="#8A8A8A"
            secureTextEntry
            value={wanikaniApiKey}
          />
        </View>
      ) : (
        <View className="mt-8">
          <View className="rounded-radius-md border border-border bg-surface px-4 py-3">
            <Text className="text-body font-semibold text-primary">Best-effort import</Text>
            <Text className="mt-2 text-body text-secondary">
              Bunpro does not offer a public API. Import requires a frontend token you can obtain
              from your browser&apos;s developer tools. This is a best-effort feature — the API may be
              unavailable.
            </Text>
            <Text className="mt-2 text-body text-secondary">
              Log into bunpro.jp in a browser, open Developer Tools, and find{' '}
              <Text className="font-semibold">frontend_api_token</Text> in your cookies.
            </Text>
          </View>

          <Text className="mt-6 text-body font-semibold text-primary">Bunpro frontend token</Text>
          <TextInput
            accessibilityLabel="Bunpro frontend token"
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-2 rounded-radius-md border border-border bg-surface px-4 py-3 text-body text-primary"
            editable={!isImporting}
            onChangeText={setBunproToken}
            placeholder="Paste your frontend_api_token cookie value"
            placeholderTextColor="#8A8A8A"
            secureTextEntry
            value={bunproToken}
          />

          <View className="mt-4 gap-2">
            <Button
              disabled={isImporting}
              label="Skip Bunpro import"
              onPress={() => router.push('/onboarding/bulk')}
              variant="secondary"
            />
            <Button
              disabled={isImporting}
              label="Mark grammar manually"
              onPress={() => router.push('/onboarding/calibrate')}
              variant="secondary"
            />
          </View>
        </View>
      )}

      {statusMessage ? (
        <Text accessibilityLiveRegion="polite" className="mt-4 text-body text-secondary">
          {statusMessage}
        </Text>
      ) : null}

      {isImporting ? (
        <View className="mt-6 items-center">
          <ActivityIndicator
            accessibilityLabel={
              selectedSource === 'wanikani'
                ? 'Importing WaniKani progress'
                : 'Importing Bunpro progress'
            }
          />
        </View>
      ) : null}

      <View className="mt-auto gap-3">
        {selectedSource === 'wanikani' ? (
          <Button
            disabled={isImporting || wanikaniApiKey.trim().length === 0}
            label="Import from WaniKani"
            onPress={handleWaniKaniImportPress}
          />
        ) : (
          <Button
            disabled={isImporting || bunproToken.trim().length === 0}
            label="Import from Bunpro"
            onPress={handleBunproImportPress}
          />
        )}
        <Button label="Back" onPress={() => router.back()} variant="secondary" />
      </View>
    </View>
  );
}
