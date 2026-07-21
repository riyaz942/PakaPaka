import { router } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { extractWordCandidates } from '@/core/ai/wordCandidates';
import { lookupFlaggedWord, type FlaggedWordLookup } from '@/data/ai/wordLookupRepository';
import { useDatabase } from '@/data/hooks/useDatabase';

type WordLookupSheetProps = {
  visible: boolean;
  /** The annotated reply the learner is looking words up from. */
  messageText: string;
  onClose: () => void;
};

/**
 * Flagged-word lookup (FR92, FR93).
 *
 * A word that exists in the curriculum deep-links to its details page. A word
 * that does not is display-and-translate only — no link, and no SRS row is ever
 * written for it, because SRS state is keyed to a curriculum item id that an
 * off-curriculum word simply does not have.
 */
export function WordLookupSheet({ visible, messageText, onClose }: WordLookupSheetProps) {
  const { userDb } = useDatabase();
  const [selected, setSelected] = useState<FlaggedWordLookup | null>(null);
  const candidates = extractWordCandidates(messageText);

  function handleSelect(word: string) {
    setSelected(lookupFlaggedWord(userDb, word));
  }

  function handleClose() {
    setSelected(null);
    onClose();
  }

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
                    onPress={() => handleSelect(word)}
                    testID={`word-candidate-${word}`}
                    className="min-h-[44px] justify-center rounded-radius-md border border-border bg-surface px-space-md py-space-sm">
                    <Text className="text-body text-primary">{word}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {selected ? (
            <View className="mt-space-lg rounded-radius-md border border-border bg-surface p-space-md">
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
              ) : (
                <>
                  <Text className="text-title text-primary">{selected.text}</Text>
                  <Text className="mt-space-sm text-body-sm text-secondary">
                    Not part of your curriculum — here for reference only. It will not be added to
                    your reviews.
                  </Text>
                </>
              )}
            </View>
          ) : null}

          <Button className="mt-space-lg" label="Close" onPress={handleClose} variant="ghost" />
        </View>
      </View>
    </Modal>
  );
}
