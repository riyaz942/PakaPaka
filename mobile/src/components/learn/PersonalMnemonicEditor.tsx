import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useDatabase } from '@/data/hooks/useDatabase';
import {
  getPersonalMnemonic,
  setPersonalMnemonic,
} from '@/data/user/mnemonicRepository';

type PersonalMnemonicEditorProps = {
  itemId: string;
};

export function PersonalMnemonicEditor({ itemId }: PersonalMnemonicEditorProps) {
  const { userDb } = useDatabase();
  const [text, setText] = useState('');

  useEffect(() => {
    setText(getPersonalMnemonic(userDb, itemId) ?? '');
  }, [userDb, itemId]);

  const handleSave = () => {
    setPersonalMnemonic(userDb, itemId, text);
    setText(text.trim());
  };

  return (
    <View className="mt-4" testID="personal-mnemonic-editor">
      <Text className="text-body-sm uppercase text-secondary">Your mnemonic</Text>
      <TextInput
        accessibilityLabel="Your personal mnemonic"
        multiline
        onChangeText={setText}
        placeholder="Add your own mnemonic…"
        testID="personal-mnemonic-input"
        value={text}
        className="mt-2 min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-2 text-body text-primary"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save personal mnemonic"
        onPress={handleSave}
        testID="personal-mnemonic-save"
        className="mt-3 min-h-[44px] items-center justify-center rounded-radius-md bg-feedback-info px-space-md py-2">
        <Text className="text-body font-semibold text-on-primary">Save</Text>
      </Pressable>
    </View>
  );
}
