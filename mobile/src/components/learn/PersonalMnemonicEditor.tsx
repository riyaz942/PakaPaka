import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MNEMONIC_PROSE } from '@/components/learn/ItemMnemonicSections';
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
    <View className="mt-space-md" testID="personal-mnemonic-editor">
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
            className="mt-space-sm min-h-[44px] rounded-radius-sm border border-border bg-surface px-space-md py-space-xs text-body text-primary"
          />
          <View className="mt-space-sm flex-row gap-space-sm">
            <Button
              className="flex-1"
              label="Save"
              disabled={!canSave}
              accessibilityLabel="Save personal mnemonic"
              onPress={handleSave}
              testID="personal-mnemonic-save"
            />
            <Button
              label="Cancel"
              variant="ghost"
              accessibilityLabel="Cancel editing personal mnemonic"
              onPress={() => setEditing(false)}
              testID="personal-mnemonic-cancel"
            />
          </View>
        </>
      ) : saved ? (
        <>
          <Text className={MNEMONIC_PROSE} testID="personal-mnemonic-text">
            {saved}
          </Text>
          <View className="mt-space-xs flex-row gap-space-md">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit personal mnemonic"
              onPress={startEditing}
              testID="personal-mnemonic-edit"
              className="min-h-[44px] justify-center">
              <Text className="text-label font-ui-semibold text-brand-text">Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete personal mnemonic"
              onPress={() => setConfirmingDelete(true)}
              testID="personal-mnemonic-delete"
              className="min-h-[44px] justify-center">
              <Text className="text-label font-ui-semibold text-feedback-incorrect-deep">
                Delete
              </Text>
            </Pressable>
          </View>

          {confirmingDelete ? (
            <View className="mt-space-sm rounded-radius-md bg-feedback-incorrect-soft p-space-md">
              <Text className="text-body-sm font-ui-medium text-feedback-incorrect-deep">
                Delete your mnemonic? This cannot be undone.
              </Text>
              <View className="mt-space-sm flex-row gap-space-md">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm delete personal mnemonic"
                  onPress={handleDelete}
                  testID="personal-mnemonic-delete-confirm"
                  className="min-h-[44px] justify-center">
                  <Text className="text-label font-ui-bold text-feedback-incorrect-deep">
                    Delete
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Keep personal mnemonic"
                  onPress={() => setConfirmingDelete(false)}
                  testID="personal-mnemonic-delete-cancel"
                  className="min-h-[44px] justify-center">
                  <Text className="text-label font-ui-semibold text-muted">Cancel</Text>
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
          <Text className="text-body-sm font-ui-medium text-muted">Add your own mnemonic…</Text>
        </Pressable>
      )}
    </View>
  );
}
