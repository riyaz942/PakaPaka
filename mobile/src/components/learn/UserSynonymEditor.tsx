import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  addSynonym,
  listSynonymsForItem,
  removeSynonym,
  type UserSynonym,
} from '@/data/user/userSynonymRepository';

type UserSynonymEditorProps = {
  itemId: string;
};

/**
 * Per-item user-added accepted meanings, mirroring PersonalMnemonicEditor.
 * Synonyms are merged into the review answer key on the next queue build.
 */
export function UserSynonymEditor({ itemId }: UserSynonymEditorProps) {
  const { userDb } = useDatabase();
  const [synonyms, setSynonyms] = useState<UserSynonym[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    setSynonyms(listSynonymsForItem(userDb, itemId));
    setText('');
  }, [userDb, itemId]);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const result = addSynonym(userDb, itemId, 'meaning', trimmed);
    if (result.ok) {
      setSynonyms(listSynonymsForItem(userDb, itemId));
      setText('');
    }
  };

  const handleRemove = (synonym: UserSynonym) => {
    const result = removeSynonym(userDb, itemId, synonym.answerType, synonym.answerText);
    if (result.ok) {
      setSynonyms(listSynonymsForItem(userDb, itemId));
    }
  };

  return (
    <View className="mt-4" testID="user-synonym-editor">
      <Text className="text-body-sm uppercase text-secondary">Your accepted answers</Text>

      {synonyms.map((synonym) => (
        <View
          key={`${synonym.answerType}:${synonym.answerText}`}
          className="mt-2 flex-row items-center justify-between rounded-radius-md border border-border bg-surface px-space-md py-2">
          <Text className="flex-1 text-body text-primary">{synonym.answerText}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove accepted answer ${synonym.answerText}`}
            onPress={() => handleRemove(synonym)}
            className="min-h-[44px] justify-center pl-space-md">
            <Text className="text-body text-feedback-incorrect">Remove</Text>
          </Pressable>
        </View>
      ))}

      <TextInput
        accessibilityLabel="Add an accepted answer"
        onChangeText={setText}
        onSubmitEditing={handleAdd}
        placeholder="Add an answer you want accepted…"
        testID="user-synonym-input"
        value={text}
        className="mt-2 min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-2 text-body text-primary"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save accepted answer"
        onPress={handleAdd}
        testID="user-synonym-save"
        className="mt-3 min-h-[44px] items-center justify-center rounded-radius-md bg-brand-600 px-space-md py-2">
        <Text className="text-body font-semibold text-on-primary">Add answer</Text>
      </Pressable>
    </View>
  );
}
