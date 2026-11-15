import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { SectionHeading } from '@/components/common/SectionHeading';
import type { AccountDevice } from '@/core/account/account.types';
import { useAccount } from '@/providers/AccountProvider';

export const DELETE_ACCOUNT_CONFIRM_COPY =
  'This deletes your account and its data on the server. Your progress on this device stays.';

function formatLastUsed(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return 'earlier';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function DeviceRow({
  device,
  disabled,
  onRemove,
}: {
  device: AccountDevice;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <View
      className="min-h-[56px] flex-row items-center gap-space-md border-b border-border py-space-sm"
      testID={`settings-account-device-${device.deviceId}`}>
      <View className="flex-1">
        <Text className="text-body font-ui-semibold text-primary">{device.label}</Text>
        <Text className="mt-[3px] text-caption font-ui-medium text-muted">
          {device.current ? (
            <Text
              className="font-ui-bold text-brand-text"
              testID={`settings-account-device-current-${device.deviceId}`}>
              This device
              {' · '}
            </Text>
          ) : null}
          {`Last used ${formatLastUsed(device.lastUsedAt)}`}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${device.label}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onRemove}
        testID={`settings-account-device-remove-${device.deviceId}`}
        className="min-h-[44px] min-w-[44px] justify-center px-space-sm">
        <Text className="text-body-sm font-ui-bold text-feedback-incorrect-deep">Remove</Text>
      </Pressable>
    </View>
  );
}

/** Optional sign-in. Signed out it is one button; nothing else in the app points here. */
export function AccountSettingsSection() {
  const account = useAccount();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // One action at a time: a second tap must not start a second server call.
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  const error = account.error ? (
    <Text
      className="mt-space-sm text-caption font-ui-medium text-feedback-incorrect-deep"
      testID="settings-account-error">
      {account.error}
    </Text>
  ) : null;

  if (account.status === 'loading') {
    return (
      <View className="mt-space-lg" testID="settings-account-section">
        <SectionHeading label="Account" />
      </View>
    );
  }

  if (account.status === 'signed_out') {
    return (
      <View className="mt-space-lg" testID="settings-account-section">
        <SectionHeading label="Account" />
        <Button
          label="Sign in to sync"
          variant="secondary"
          onPress={() => void run(account.signIn)}
          disabled={busy}
          className="mt-space-sm w-full"
          testID="settings-account-signin"
        />
        <Text className="mt-space-xs text-caption font-ui-medium text-muted">
          Optional. Keeps your progress the same on all your devices.
        </Text>
        {error}
      </View>
    );
  }

  return (
    <View className="mt-space-lg" testID="settings-account-section">
      <SectionHeading label="Account" />
      <Text
        className="mt-space-xs text-body font-ui-semibold text-primary"
        testID="settings-account-provider">
        Signed in with Google
      </Text>

      <Button
        label="Sync now"
        variant="secondary"
        onPress={() => {}}
        disabled
        className="mt-space-sm w-full"
        testID="settings-account-sync"
      />
      <Text className="mt-space-xs text-caption font-ui-medium text-muted">
        Sync arrives in a later update.
      </Text>

      {account.account && account.account.devices.length > 0 ? (
        <View
          className="mt-space-sm rounded-radius-md border border-border bg-surface px-space-md shadow-e1"
          testID="settings-account-devices">
          {account.account.devices.map((device) => (
            <DeviceRow
              key={device.deviceId}
              device={device}
              disabled={busy}
              onRemove={() => void run(() => account.removeDevice(device.deviceId))}
            />
          ))}
        </View>
      ) : null}

      {error}

      <Button
        label="Sign out"
        variant="secondary"
        onPress={() => void run(account.signOut)}
        disabled={busy}
        className="mt-space-md w-full"
        testID="settings-account-signout"
      />
      <Button
        label="Sign out everywhere"
        variant="secondary"
        onPress={() => void run(account.signOutEverywhere)}
        disabled={busy}
        className="mt-space-sm w-full"
        testID="settings-account-signout-everywhere"
      />

      {confirmingDelete ? (
        <View
          className="mt-space-sm gap-space-sm rounded-radius-md border border-border bg-surface px-space-md py-space-md"
          testID="settings-account-delete-confirm">
          <Text accessibilityRole="alert" className="text-body-sm font-ui-semibold text-primary">
            {DELETE_ACCOUNT_CONFIRM_COPY}
          </Text>
          <Button
            label="Delete account"
            variant="destructive"
            onPress={() => {
              setConfirmingDelete(false);
              void run(account.deleteAccount);
            }}
            disabled={busy}
            testID="settings-account-delete-confirm-button"
          />
          <Button
            label="Cancel"
            variant="tertiary"
            onPress={() => setConfirmingDelete(false)}
            testID="settings-account-delete-cancel"
          />
        </View>
      ) : (
        <Button
          label="Delete account"
          variant="destructive"
          onPress={() => setConfirmingDelete(true)}
          disabled={busy}
          className="mt-space-sm w-full"
          testID="settings-account-delete"
        />
      )}
    </View>
  );
}
