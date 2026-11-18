import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { useSheetFrame } from '@/hooks/useWideLayout';
import { cn } from '@/utils/cn';

type SignOutSheetProps = {
  visible: boolean;
  /** "Sign out everywhere" changes the title and adds a line about the other devices. */
  everywhere: boolean;
  step: 'confirm' | 'sync_failed';
  /** Disables the buttons while the sync or sign-out runs. */
  busy: boolean;
  /** Shown on the sync_failed step. */
  syncError: string | null;
  /** "Sync and sign out" and "Try again". */
  onConfirm: () => void;
  onEraseAnyway: () => void;
  onCancel: () => void;
};

/**
 * Signing out syncs first, then erases this device. The first step says so. If the
 * sync does not finish, the second step says what an erase would cost and leaves the
 * choice to the learner: try again, erase anyway, or cancel.
 */
export function SignOutSheet({
  visible,
  everywhere,
  step,
  busy,
  syncError,
  onConfirm,
  onEraseAnyway,
  onCancel,
}: SignOutSheetProps) {
  const sheetFrame = useSheetFrame();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-black/50">
        <View
          className={cn(
            'gap-space-md rounded-t-radius-xl border-t border-border bg-surface px-space-lg pb-space-2xl pt-space-lg shadow-e3',
            sheetFrame.className,
          )}
          style={sheetFrame.style}
          testID="signout-sheet">
          <View className="h-1 w-10 self-center rounded-radius-full bg-border" />
          {step === 'sync_failed' ? (
            <>
              <Text className="text-title-lg font-ui-extrabold text-primary">
                Sync did not finish
              </Text>
              <Text className="text-body text-secondary">
                {`${syncError ?? 'The sync did not finish.'} If you erase now, progress that is not synced yet is lost.`}
              </Text>
              <View className="gap-space-sm pt-space-sm">
                <Button label="Try again" onPress={onConfirm} disabled={busy} />
                <Button
                  label="Erase anyway"
                  onPress={onEraseAnyway}
                  variant="destructive"
                  disabled={busy}
                />
                <Button label="Cancel" onPress={onCancel} variant="ghost" disabled={busy} />
              </View>
            </>
          ) : (
            <>
              <Text className="text-title-lg font-ui-extrabold text-primary">
                {everywhere ? 'Sign out everywhere?' : 'Sign out?'}
              </Text>
              <Text className="text-body text-secondary">
                Your progress syncs first. Then it is erased from this device. Sign in again to get
                it back.
              </Text>
              {everywhere ? (
                <Text className="text-body text-secondary">
                  Your other devices are signed out too. Each one erases its progress. If a device
                  has progress that is not synced, it asks first.
                </Text>
              ) : null}
              <View className="gap-space-sm pt-space-sm">
                <Button
                  label={busy ? 'Syncing…' : 'Sync and sign out'}
                  onPress={onConfirm}
                  variant="destructive"
                  disabled={busy}
                />
                <Button label="Cancel" onPress={onCancel} variant="ghost" disabled={busy} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
