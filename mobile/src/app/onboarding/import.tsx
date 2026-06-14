import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { useDatabase } from '@/data/hooks/useDatabase';
import { setImportPreview } from '@/data/import/importPreviewStore';
import { saveImportCredential } from '@/data/user/credentialStore';
import {
  previewAnkiImport,
  previewBunproImport,
  previewWaniKaniImport,
} from '@/data/user/importRepository';

type ImportSource = 'wanikani' | 'bunpro' | 'anki';

function getImportErrorMessage(error: { userMessage?: string; message: string }): string {
  return error.userMessage ?? error.message;
}

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const { curriculumDb } = useDatabase();
  const [selectedSource, setSelectedSource] = useState<ImportSource>('wanikani');
  const [wanikaniApiKey, setWanikaniApiKey] = useState('');
  const [bunproToken, setBunproToken] = useState('');
  const [ankiFileUri, setAnkiFileUri] = useState<string | null>(null);
  const [ankiFileName, setAnkiFileName] = useState<string | null>(null);
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

      const previewResult = await previewWaniKaniImport(curriculumDb);
      if (!previewResult.ok) {
        setStatusMessage(getImportErrorMessage(previewResult.error));
        return;
      }

      setImportPreview(previewResult.value);
      setWanikaniApiKey('');
      router.push('./import-summary');
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

      const previewResult = await previewBunproImport(curriculumDb);
      if (!previewResult.ok) {
        setStatusMessage(getImportErrorMessage(previewResult.error));
        return;
      }

      setImportPreview(previewResult.value);
      setBunproToken('');
      router.push('./import-summary');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSelectAnkiDeckPress() {
    setStatusMessage(null);

    const pickerResult = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['application/zip', 'application/octet-stream'],
    });

    if (pickerResult.canceled || !pickerResult.assets?.[0]) {
      return;
    }

    const asset = pickerResult.assets[0];
    setAnkiFileUri(asset.uri);
    setAnkiFileName(asset.name ?? 'Selected deck.apkg');
  }

  async function handleAnkiImportPress() {
    if (!ankiFileUri) {
      return;
    }

    setStatusMessage(null);
    setIsImporting(true);

    try {
      const previewResult = await previewAnkiImport(curriculumDb, ankiFileUri);
      if (!previewResult.ok) {
        setStatusMessage(getImportErrorMessage(previewResult.error));
        return;
      }

      setImportPreview(previewResult.value);
      setAnkiFileUri(null);
      setAnkiFileName(null);
      router.push('./import-summary');
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
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selectedSource === 'anki' }}
          className={`flex-1 rounded-radius-md border px-4 py-3 ${
            selectedSource === 'anki' ? 'border-primary bg-surface' : 'border-border'
          }`}
          disabled={isImporting}
          onPress={() => handleSourceChange('anki')}>
          <Text className="text-center text-body font-semibold text-primary">Anki</Text>
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
      ) : null}

      {selectedSource === 'bunpro' ? (
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
      ) : null}

      {selectedSource === 'anki' ? (
        <View className="mt-8">
          <View className="rounded-radius-md border border-border bg-surface px-4 py-3">
            <Text className="text-body font-semibold text-primary">Local deck import</Text>
            <Text className="mt-2 text-body text-secondary">
              Your deck file is processed entirely on this device. No data is sent to any server.
            </Text>
          </View>

          <Button
            className="mt-6"
            disabled={isImporting}
            label="Select Anki deck file"
            onPress={handleSelectAnkiDeckPress}
            variant="secondary"
          />

          {ankiFileName ? (
            <Text className="mt-4 text-body text-secondary">Selected: {ankiFileName}</Text>
          ) : null}
        </View>
      ) : null}

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
                : selectedSource === 'bunpro'
                  ? 'Importing Bunpro progress'
                  : 'Processing Anki deck'
            }
          />
          {selectedSource === 'anki' ? (
            <Text className="mt-2 text-body text-secondary">Processing deck...</Text>
          ) : null}
        </View>
      ) : null}

      <View className="mt-auto gap-3">
        {selectedSource === 'wanikani' ? (
          <Button
            disabled={isImporting || wanikaniApiKey.trim().length === 0}
            label="Import from WaniKani"
            onPress={handleWaniKaniImportPress}
          />
        ) : null}
        {selectedSource === 'bunpro' ? (
          <Button
            disabled={isImporting || bunproToken.trim().length === 0}
            label="Import from Bunpro"
            onPress={handleBunproImportPress}
          />
        ) : null}
        {selectedSource === 'anki' ? (
          <Button
            disabled={isImporting || !ankiFileUri}
            label="Import from Anki"
            onPress={handleAnkiImportPress}
          />
        ) : null}
        <Button label="Back" onPress={() => router.back()} variant="secondary" />
      </View>
    </View>
  );
}
