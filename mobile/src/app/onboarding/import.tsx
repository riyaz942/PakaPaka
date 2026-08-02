import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/common/Banner';
import { Button } from '@/components/common/Button';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SegmentedPill, type SegmentedPillOption } from '@/components/common/SegmentedPill';
import { JlptLevelPicker } from '@/components/onboarding/JlptLevelPicker';
import { getSemanticColors } from '@/constants/semantic-colors';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { setImportPreview } from '@/data/import/importPreviewStore';
import { saveImportCredential } from '@/data/user/credentialStore';
import {
  previewAnkiImport,
  previewBunproImport,
  previewWaniKaniImport,
} from '@/data/user/importRepository';
import {
  getStartingJlptLevel,
  setOnboardingPath,
  setStartingJlptLevel,
} from '@/data/user/preferencesRepository';
import { usePaintedColorScheme } from '@/hooks/use-painted-color-scheme';

type ImportSource = 'wanikani' | 'bunpro' | 'anki';

const NETWORK_NOTICE =
  'Requires a one-time internet connection. Data stays on your device after import.';

const SOURCE_OPTIONS: readonly SegmentedPillOption<ImportSource>[] = [
  { value: 'wanikani', label: 'WaniKani' },
  { value: 'bunpro', label: 'Bunpro' },
  { value: 'anki', label: 'Anki' },
];

function getImportErrorMessage(error: { userMessage?: string; message: string }): string {
  return error.userMessage ?? error.message;
}

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const colors = getSemanticColors(usePaintedColorScheme());
  const { curriculumDb, userDb } = useDatabase();
  const [selectedSource, setSelectedSource] = useState<ImportSource>('wanikani');
  const [selectedJlptLevel, setSelectedJlptLevel] = useState<JLPTLevel | null>(
    () => getStartingJlptLevel(userDb) ?? 'N3',
  );
  const [wanikaniApiKey, setWanikaniApiKey] = useState('');
  const [bunproToken, setBunproToken] = useState('');
  const [ankiFileUri, setAnkiFileUri] = useState<string | null>(null);
  const [ankiFileName, setAnkiFileName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  function persistJlptLevel(level: JLPTLevel) {
    setSelectedJlptLevel(level);
    setStartingJlptLevel(userDb, level);
  }

  function handleSkipImport() {
    if (!selectedJlptLevel) {
      setStatusMessage('Select your JLPT level first.');
      return;
    }

    setStartingJlptLevel(userDb, selectedJlptLevel);
    setOnboardingPath(userDb, 'manual');
    router.push('/onboarding/intensity');
  }

  async function handleWaniKaniImportPress() {
    if (!selectedJlptLevel) {
      setStatusMessage('Select your JLPT level first.');
      return;
    }

    setStartingJlptLevel(userDb, selectedJlptLevel);
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
    if (!selectedJlptLevel) {
      setStatusMessage('Select your JLPT level first.');
      return;
    }

    setStartingJlptLevel(userDb, selectedJlptLevel);
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

    if (!selectedJlptLevel) {
      setStatusMessage('Select your JLPT level first.');
      return;
    }

    setStartingJlptLevel(userDb, selectedJlptLevel);
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
      <Text
        accessibilityRole="header"
        className="text-title-lg font-ui-extrabold tracking-[-0.01em] text-primary">
        Import my progress
      </Text>
      <Text className="mt-[9px] text-body-sm font-ui text-muted">
        Bring SRS progress from another study tool. Credentials stay in secure storage only for the
        import and are removed after a successful import.
      </Text>

      <View className="mt-space-lg">
        <Text className="text-body font-ui-semibold text-primary">
          What level are you studying toward?
        </Text>
        <JlptLevelPicker
          selectedLevel={selectedJlptLevel}
          onSelect={persistJlptLevel}
          testID="import-jlpt-picker"
        />
      </View>

      <SegmentedPill
        accessibilityLabel="Import source"
        className="mt-space-lg"
        disabled={isImporting}
        onChange={handleSourceChange}
        options={SOURCE_OPTIONS}
        value={selectedSource}
      />

      {selectedSource === 'wanikani' ? (
        <View className="mt-space-lg">
          <SectionHeading label="WaniKani API key" />
          <Text className="mt-space-sm text-body-sm font-ui text-muted">
            Import from WaniKani maps your assignments to this app&apos;s curriculum and converts SRS
            stages to FSRS.
          </Text>
          <Banner className="mt-space-sm" message={NETWORK_NOTICE} variant="info" visible />
          <TextInput
            accessibilityLabel="WaniKani API key"
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-space-sm min-h-[48px] rounded-radius-sm border border-border bg-surface px-space-md text-body font-ui text-primary"
            editable={!isImporting}
            onChangeText={setWanikaniApiKey}
            placeholder="Paste your WaniKani v2 API key"
            placeholderTextColor={colors.faint}
            secureTextEntry
            value={wanikaniApiKey}
          />
        </View>
      ) : null}

      {selectedSource === 'bunpro' ? (
        <View className="mt-space-lg">
          <View className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
            <Text className="text-body font-ui-extrabold text-primary">Best-effort import</Text>
            <Text className="mt-space-sm text-body-sm font-ui text-muted">
              Bunpro does not offer a public API. Import requires a frontend token you can obtain
              from your browser&apos;s developer tools. This is a best-effort feature — the API may be
              unavailable.
            </Text>
            <Text className="mt-space-sm text-body-sm font-ui text-muted">
              Log into bunpro.jp in a browser, open Developer Tools, and find{' '}
              <Text className="font-ui-bold text-secondary">frontend_api_token</Text> in your
              cookies.
            </Text>
          </View>

          <Banner className="mt-space-sm" message={NETWORK_NOTICE} variant="info" visible />

          <SectionHeading label="Bunpro frontend token" />
          <TextInput
            accessibilityLabel="Bunpro frontend token"
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-space-sm min-h-[48px] rounded-radius-sm border border-border bg-surface px-space-md text-body font-ui text-primary"
            editable={!isImporting}
            onChangeText={setBunproToken}
            placeholder="Paste your frontend_api_token cookie value"
            placeholderTextColor={colors.faint}
            secureTextEntry
            value={bunproToken}
          />
        </View>
      ) : null}

      {selectedSource === 'anki' ? (
        <View className="mt-space-lg">
          <View className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
            <Text className="text-body font-ui-extrabold text-primary">Local deck import</Text>
            <Text className="mt-space-sm text-body-sm font-ui text-muted">
              Your deck file is processed entirely on this device. No data is sent to any server.
            </Text>
          </View>

          <Button
            className="mt-space-md"
            disabled={isImporting}
            label="Select Anki deck file"
            onPress={handleSelectAnkiDeckPress}
            variant="secondary"
          />

          {ankiFileName ? (
            <Text className="mt-space-sm text-body-sm font-ui-medium text-secondary">
              Selected: {ankiFileName}
            </Text>
          ) : null}
        </View>
      ) : null}

      {statusMessage ? (
        <View accessibilityLiveRegion="polite">
          <Banner className="mt-space-md" message={statusMessage} variant="error" visible />
        </View>
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
            <Text className="mt-space-sm text-body-sm font-ui-medium text-secondary">
              Processing deck...
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className="mt-auto gap-space-sm">
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
        <Button
          disabled={isImporting}
          label="Mark manually instead"
          onPress={handleSkipImport}
          variant="secondary"
        />
        <Button label="Back" onPress={() => router.back()} variant="ghost" />
      </View>
    </View>
  );
}
