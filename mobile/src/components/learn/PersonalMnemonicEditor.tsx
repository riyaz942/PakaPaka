import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SectionHeading } from '@/components/common/SectionHeading';
import { useDatabase } from '@/data/hooks/useDatabase';
import {
  clearPersonalMnemonic,
  getPersonalMnemonic,
  setPersonalMnemonic,
} from '@/data/user/mnemonicRepository';

type PersonalMnemonicEditorProps = {
  itemId: string;
};

/**
 * Personal mnemonic with explicit content states (FR75, FR26b):
 *
 * - **empty** — a muted "add your own" line, not a permanently open text box
 * - **saved** — the mnemonic as text, with Edit and Delete
 * - **editing** — the input, with Save disabled while the text is blank
 *
 * Delete asks first, inline. Storage stays local and one-per-item.
 */
export function PersonalMnemonicEditor({ itemId }: PersonalMnemonicEditorProps) {
  const { userDb } = useDatabase();
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setSaved(getPersonalMnemonic(userDb, itemId));
    setDraft('');
    setEditing(false);
    setConfirmingDelete(false);
  }, [userDb, itemId]);

  const canSave = draft.trim().length > 0;

  const startEditing = () => {
    setDraft(saved ?? '');
    setConfirmingDelete(false);
    setEditing(true);
  };

  const handleSave = () => {
    if (!canSave) {
      return;
    }
    const trimmed = draft.trim();
    setPersonalMnemonic(userDb, itemId, trimmed);
    setSaved(trimmed);
    setEditing(false);
  };

  const handleDelete = () => {
    clearPersonalMnemonic(userDb, itemId);
    setSaved(null);
    setDraft('');
    setConfirmingDelete(false);
  };

  return (
    <View className="mt-4" testID="personal-mnemonic-editor">
      <SectionHeading label="Your mnemonic" />

      {editing ? (
        <>
          <TextInput
            accessibilityLabel="Your personal mnemonic"
            autoFocus
            multiline
            onChangeText={setDraft}
            placeholder="Add your own mnemonic…"
            testID="personal-mnemonic-input"
            value={draft}
            className="mt-2 min-h-[44px] rounded-radius-md border border-border bg-surface px-space-md py-2 text-body text-primary"
          />
          <View className="mt-3 flex-row gap-space-sm">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save personal mnemonic"
              accessibilityState={{ disabled: !canSave }}
              disabled={!canSave}
              onPress={handleSave}
              testID="personal-mnemonic-save"
              className={`min-h-[44px] flex-1 items-center justify-center rounded-radius-md px-space-md py-2 ${
                canSave ? 'bg-feedback-info' : 'bg-surface'
              }`}>
              <Text
                className={`text-body font-semibold ${
                  canSave ? 'text-on-primary' : 'text-secondary'
                }`}>
                Save
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel editing personal mnemonic"
              onPress={() => setEditing(false)}
              testID="personal-mnemonic-cancel"
              className="min-h-[44px] items-center justify-center rounded-radius-md px-space-md py-2">
              <Text className="text-body text-secondary">Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : saved ? (
        <>
          <Text className="mt-1 text-body text-primary" testID="personal-mnemonic-text">
            {saved}
          </Text>
          <View className="mt-2 flex-row gap-space-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit personal mnemonic"
              onPress={startEditing}
              testID="personal-mnemonic-edit"
              className="min-h-[44px] justify-center">
              <Text className="text-body text-feedback-info">Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete personal mnemonic"
              onPress={() => setConfirmingDelete(true)}
              testID="personal-mnemonic-delete"
              className="min-h-[44px] justify-center">
              <Text className="text-body text-feedback-incorrect">Delete</Text>
            </Pressable>
          </View>

          {confirmingDelete ? (
            <View className="mt-2 rounded-radius-md border border-border bg-surface p-space-md">
              <Text className="text-body-sm text-secondary">
                Delete your mnemonic? This cannot be undone.
              </Text>
              <View className="mt-2 flex-row gap-space-md">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm delete personal mnemonic"
                  onPress={handleDelete}
                  testID="personal-mnemonic-delete-confirm"
                  className="min-h-[44px] justify-center">
                  <Text className="text-body font-semibold text-feedback-incorrect">
                    Delete
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Keep personal mnemonic"
                  onPress={() => setConfirmingDelete(false)}
                  testID="personal-mnemonic-delete-cancel"
                  className="min-h-[44px] justify-center">
                  <Text className="text-body text-secondary">Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add your own mnemonic"
          onPress={startEditing}
          testID="personal-mnemonic-empty"
          className="min-h-[44px] justify-center">
          <Text className="text-body text-secondary">Add your own mnemonic…</Text>
        </Pressable>
      )}
    </View>
  );
}
