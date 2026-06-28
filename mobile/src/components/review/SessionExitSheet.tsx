import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

type SessionExitSheetProps = {
  visible: boolean;
  onKeepGoing: () => void;
  onEndSession: () => void;
};

export function SessionExitSheet({ visible, onKeepGoing, onEndSession }: SessionExitSheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onKeepGoing}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-[16px] bg-surface-elevated px-space-lg pb-space-2xl pt-space-lg gap-space-md">
          <Text className="text-title font-semibold text-primary">End session?</Text>
          <Text className="text-body text-secondary">Progress is saved.</Text>
          <View className="gap-space-sm pt-space-sm">
            <Button label="End session" onPress={onEndSession} variant="destructive" />
            <Button label="Keep going" onPress={onKeepGoing} variant="ghost" />
          </View>
        </View>
      </View>
    </Modal>
  );
}
