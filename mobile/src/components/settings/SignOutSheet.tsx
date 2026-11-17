import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { useSheetFrame } from '@/hooks/useWideLayout';
import { cn } from '@/utils/cn';

type SignOutSheetProps = {
  visible: boolean;
  /** "Sign out everywhere" changes the title only. */
  everywhere: boolean;
  /** `eraseData` is true when the user also wants this device's progress erased. */
  onConfirm: (eraseData: boolean) => void;
  onCancel: () => void;
};

/**
 * Signing out keeps the progress on the device, so the learner still sees it.
 * This says so, and offers to erase it. An erase does not touch the copy on the
 * server, but progress that is not synced yet is lost: the second step says that
 * plainly and points to Sync now.
 */
export function SignOutSheet({ visible, everywhere, onConfirm, onCancel }: SignOutSheetProps) {
  const sheetFrame = useSheetFrame();
  const [confirmingErase, setConfirmingErase] = useState(false);

  useEffect(() => {
    if (!visible) setConfirmingErase(false);
  }, [visible]);

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
          {confirmingErase ? (
            <>
              <Text className="text-title-lg font-ui-extrabold text-primary">
                Erase data on this device?
              </Text>
              <Text className="text-body text-secondary">
                This erases all your progress and settings on this device. Progress that is not synced
                yet is lost. To keep it, cancel and tap Sync now first.
              </Text>
              <View className="gap-space-sm pt-space-sm">
                <Button
                  label="Erase and sign out"
                  onPress={() => onConfirm(true)}
                  variant="destructive"
                />
                <Button label="Go back" onPress={() => setConfirmingErase(false)} variant="ghost" />
              </View>
            </>
          ) : (
            <>
              <Text className="text-title-lg font-ui-extrabold text-primary">
                {everywhere ? 'Sign out everywhere?' : 'Sign out?'}
              </Text>
              <Text className="text-body text-secondary">
                Your progress stays on this device after you sign out, so you will still see it.
                The copy that is already synced stays on our server until you delete your account.
              </Text>
              <View className="gap-space-sm pt-space-sm">
                <Button label="Sign out, keep my data" onPress={() => onConfirm(false)} />
                <Button
                  label="Sign out and erase my data"
                  onPress={() => setConfirmingErase(true)}
                  variant="destructive"
                />
                <Button label="Cancel" onPress={onCancel} variant="ghost" />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
