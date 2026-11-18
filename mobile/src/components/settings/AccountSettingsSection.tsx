import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { SectionHeading } from '@/components/common/SectionHeading';
import type { AccountDevice } from '@/core/account/account.types';
import { SignOutSheet } from '@/components/settings/SignOutSheet';
import { useAccount } from '@/providers/AccountProvider';
import { useSync } from '@/providers/SyncProvider';

export const DELETE_ACCOUNT_CONFIRM_COPY =
  'This deletes your account and your progress on our server. All your devices are signed out, and this device is erased. This cannot be undone.';

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

type AccountSettingsSectionProps = {
  /** Called after a sign-out or an account delete, to erase this device's data and leave. */
  onEraseLocalData?: () => void;
};

/** Optional sign-in. Signed out it is one button; nothing else in the app points here. */
export function AccountSettingsSection({ onEraseLocalData }: AccountSettingsSectionProps = {}) {
  const account = useAccount();
  const sync = useSync();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signOutAsk, setSignOutAsk] = useState<'here' | 'everywhere' | null>(null);
  const [signOutStep, setSignOutStep] = useState<'confirm' | 'sync_failed'>('confirm');

  // One action at a time: a second tap must not start a second server call.
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function closeSignOut() {
    setSignOutAsk(null);
    setSignOutStep('confirm');
  }

  // Erase only after the sign-out worked: a failed sign-out must not cost data.
  async function signOutThenErase() {
    const signedOut = await (signOutAsk === 'everywhere'
      ? account.signOutEverywhere()
      : account.signOut());
    closeSignOut();
    if (signedOut) onEraseLocalData?.();
  }

  // "Sync and sign out" and "Try again": the erase waits for a sync that finished.
  async function syncThenSignOut() {
    setBusy(true);
    try {
      if (!(await sync.syncBeforeSignOut())) {
        setSignOutStep('sync_failed');
        return;
      }
      await signOutThenErase();
    } finally {
      setBusy(false);
    }
  }

  // The learner pressed "Erase anyway": no sync.
  async function eraseAnyway() {
    setBusy(true);
    try {
      await signOutThenErase();
    } finally {
      setBusy(false);
    }
  }

  async function deleteThenErase() {
    setBusy(true);
    try {
      if (await account.deleteAccount()) onEraseLocalData?.();
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
        onPress={() => void sync.syncNow()}
        disabled={sync.phase !== 'idle'}
        className="mt-space-sm w-full"
        testID="settings-account-sync"
      />
      <Text className="mt-space-xs text-caption font-ui-medium text-muted">
        {sync.phase !== 'idle'
          ? 'Syncing…'
          : sync.lastSyncedAt
            ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleString()}`
            : 'Not synced yet.'}
      </Text>
      {sync.error ? (
        <Text
          className="mt-space-sm text-caption font-ui-medium text-feedback-incorrect-deep"
          testID="settings-account-sync-error">
          {sync.error}
        </Text>
      ) : null}

      {account.account && account.account.devices.length > 0 ? (
        <View
          className="mt-space-sm rounded-radius-md border border-border bg-surface px-space-md shadow-e1"
          testID="settings-account-devices">
          {account.account.devices.map((device) => (
            <DeviceRow
              key={device.deviceId}
              device={device}
              disabled={busy}
              onRemove={() =>
                device.current
                  ? setSignOutAsk('here')
                  : void run(() => account.removeDevice(device.deviceId))
              }
            />
          ))}
        </View>
      ) : null}

      {error}

      <Button
        label="Sign out"
        variant="secondary"
        onPress={() => setSignOutAsk('here')}
        disabled={busy}
        className="mt-space-md w-full"
        testID="settings-account-signout"
      />
      <Button
        label="Sign out everywhere"
        variant="secondary"
        onPress={() => setSignOutAsk('everywhere')}
        disabled={busy}
        className="mt-space-sm w-full"
        testID="settings-account-signout-everywhere"
      />

      <SignOutSheet
        visible={signOutAsk !== null}
        everywhere={signOutAsk === 'everywhere'}
        step={signOutStep}
        busy={busy}
        syncError={sync.error}
        onConfirm={() => void syncThenSignOut()}
        onEraseAnyway={() => void eraseAnyway()}
        onCancel={closeSignOut}
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
              void deleteThenErase();
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
