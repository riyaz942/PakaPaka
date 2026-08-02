import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { SectionHeading } from '@/components/common/SectionHeading';
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
    <View className="mt-space-md" testID="user-synonym-editor">
      <SectionHeading label="Your accepted answers" />

      {synonyms.map((synonym) => (
        <View
          key={`${synonym.answerType}:${synonym.answerText}`}
          className="mt-space-sm flex-row items-center justify-between rounded-radius-md border border-border bg-surface px-space-md py-space-xs">
          <Text className="flex-1 text-body text-primary">{synonym.answerText}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove accepted answer ${synonym.answerText}`}
            onPress={() => handleRemove(synonym)}
            className="min-h-[44px] justify-center pl-space-md">
            <Text className="text-label font-ui-semibold text-feedback-incorrect-deep">
              Remove
            </Text>
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
        className="mt-space-sm min-h-[44px] rounded-radius-sm border border-border bg-surface px-space-md py-space-xs text-body text-primary"
      />
      <Button
        className="mt-space-sm"
        label="Add answer"
        variant="secondary"
        accessibilityLabel="Save accepted answer"
        onPress={handleAdd}
        testID="user-synonym-save"
      />
    </View>
  );
}
