import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { extractWordCandidates } from '@/core/ai/wordCandidates';
import type { ByokProvider } from '@/data/ai/byokCredential.types';
import {
  translateOffCurriculumWord,
  type OffCurriculumTranslation,
} from '@/data/ai/translateOffCurriculum';
import { lookupFlaggedWord, type FlaggedWordLookup } from '@/data/ai/wordLookupRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { getWordTranslateOptIn } from '@/data/user/preferencesRepository';

type WordLookupSheetProps = {
  visible: boolean;
  /** The annotated reply the learner is looking words up from. */
  messageText: string;
  /** The session this reply belongs to — translation bills its provider. */
  session: { provider: ByokProvider; model: string } | null;
  onClose: () => void;
};

type SelectedLookup =
  | Extract<FlaggedWordLookup, { kind: 'curriculum' }>
  | { kind: 'off_curriculum_translated'; translation: OffCurriculumTranslation }
  | { kind: 'off_curriculum_pending'; text: string }
  | { kind: 'off_curriculum_failed'; text: string; message: string }
  | { kind: 'off_curriculum_plain'; text: string };

/**
 * Flagged-word lookup (FR92, FR93).
 *
 * A word that exists in the curriculum deep-links to its details page. A word
 * that does not is shown as-is, and — only if the learner has opted into
 * spending a provider call on it — glossed once via BYOK. Either way there is
 * no link and no SRS row, because SRS state is keyed to a curriculum item id
 * that an off-curriculum word simply does not have.
 */
export function WordLookupSheet({
  visible,
  messageText,
  session,
  onClose,
}: WordLookupSheetProps) {
  const { userDb } = useDatabase();
  const [selected, setSelected] = useState<SelectedLookup | null>(null);
  const candidates = extractWordCandidates(messageText);
  // Only the newest tap may paint. Without this, a slow first lookup lands
  // after a second tap and shows the wrong gloss under the right word.
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const cancelInFlight = useCallback(() => {
    requestRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => cancelInFlight, [cancelInFlight]);

  // A different message means different candidates; the open result belongs to
  // the previous one.
  useEffect(() => {
    cancelInFlight();
    setSelected(null);
  }, [messageText, cancelInFlight]);

  async function handleSelect(word: string) {
    cancelInFlight();
    const requestId = requestRef.current;

    const lookup = lookupFlaggedWord(userDb, word);
    if (lookup.kind === 'curriculum') {
      setSelected(lookup);
      return;
    }

    if (!session || !getWordTranslateOptIn(userDb)) {
      setSelected({ kind: 'off_curriculum_plain', text: lookup.text });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSelected({ kind: 'off_curriculum_pending', text: lookup.text });

    const translated = await translateOffCurriculumWord(
      userDb,
      lookup.text,
      session,
      controller.signal,
    );
    if (requestId !== requestRef.current) {
      return;
    }
    abortRef.current = null;

    if (!translated.ok) {
      const reason = translated.error.userMessage?.trim();
      setSelected({
        kind: 'off_curriculum_failed',
        text: lookup.text,
        message: reason && reason.length > 0 ? reason : 'That word could not be looked up.',
      });
      return;
    }
    setSelected({ kind: 'off_curriculum_translated', translation: translated.value });
  }

  function handleClose() {
    cancelInFlight();
    setSelected(null);
    onClose();
  }

  const isLookingUp = selected?.kind === 'off_curriculum_pending';

  function handleOpenDetails(itemId: string) {
    handleClose();
    router.push(`/browse/item/${itemId}`);
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={handleClose}
      accessibilityViewIsModal>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[70%] rounded-t-radius-lg border-t border-border bg-background p-space-lg">
          <Text accessibilityRole="header" className="text-title text-primary">
            Look up a word
          </Text>

          {candidates.length === 0 ? (
            <Text className="mt-space-md text-body text-secondary">
              No kanji words to look up in this message.
            </Text>
          ) : (
            <ScrollView className="mt-space-md">
              <View className="flex-row flex-wrap gap-space-sm">
                {candidates.map((word) => (
                  <Pressable
                    key={word}
                    accessibilityRole="button"
                    accessibilityLabel={`Look up ${word}`}
                    accessibilityState={{ disabled: isLookingUp }}
                    disabled={isLookingUp}
                    onPress={() => {
                      void handleSelect(word);
                    }}
                    testID={`word-candidate-${word}`}
                    className={`min-h-[44px] justify-center rounded-radius-md border border-border bg-surface px-space-md py-space-sm ${
                      isLookingUp ? 'opacity-50' : ''
                    }`}>
                    <Text className="text-body text-primary">{word}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {selected ? (
            <ScrollView
              className="mt-space-lg max-h-[40%] rounded-radius-md border border-border bg-surface"
              contentContainerClassName="p-space-md">
              {selected.kind === 'curriculum' ? (
                <>
                  <Text className="text-title text-primary">{selected.primaryForm}</Text>
                  <Text className="mt-space-xs text-body text-secondary">{selected.meaning}</Text>
                  <Text className="mt-space-sm text-body-sm text-secondary">
                    {selected.studied
                      ? 'You have studied this one already.'
                      : 'This is in your curriculum but you have not studied it yet.'}
                  </Text>
                  <Button
                    className="mt-space-md"
                    label="Open details"
                    onPress={() => handleOpenDetails(selected.itemId)}
                    testID="word-open-details"
                    variant="secondary"
                  />
                </>
              ) : selected.kind === 'off_curriculum_pending' ? (
                <>
                  <Text className="text-title text-primary">{selected.text}</Text>
                  <View className="mt-space-md flex-row items-center gap-space-sm">
                    <ActivityIndicator accessibilityLabel="Looking up translation" />
                    <Text className="text-body-sm text-secondary">Asking your provider…</Text>
                  </View>
                </>
              ) : selected.kind === 'off_curriculum_failed' ? (
                <>
                  <Text className="text-title text-primary">{selected.text}</Text>
                  <Text
                    accessibilityLiveRegion="polite"
                    className="mt-space-sm text-body text-feedback-incorrect">
                    {selected.message}
                  </Text>
                  <Text className="mt-space-sm text-body-sm text-secondary">
                    Not part of your curriculum — it will not be added to your reviews.
                  </Text>
                </>
              ) : selected.kind === 'off_curriculum_plain' ? (
                <>
                  <Text className="text-title text-primary">{selected.text}</Text>
                  <Text className="mt-space-sm text-body-sm text-secondary">
                    Not part of your curriculum — here for reference only. It will not be added to
                    your reviews.
                  </Text>
                  <Text className="mt-space-sm text-body-sm text-secondary">
                    Turn on “Translate unknown words” in Settings to spend a provider call looking
                    this up.
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-title text-primary">{selected.translation.text}</Text>
                  {selected.translation.reading.length > 0 ? (
                    <Text className="mt-space-xs text-body text-secondary">
                      {selected.translation.reading}
                    </Text>
                  ) : null}
                  {selected.translation.meaning.length > 0 ? (
                    <Text className="mt-space-xs text-body text-primary">
                      {selected.translation.meaning}
                    </Text>
                  ) : null}
                  <Text className="mt-space-sm text-body-sm text-secondary">
                    Not part of your curriculum — here for reference only. It will not be added to
                    your reviews.
                  </Text>
                </>
              )}
            </ScrollView>
          ) : null}

          <Button className="mt-space-lg" label="Close" onPress={handleClose} variant="ghost" />
        </View>
      </View>
    </Modal>
  );
}
