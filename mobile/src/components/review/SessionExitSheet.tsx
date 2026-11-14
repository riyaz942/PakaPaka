import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { useSheetFrame } from '@/hooks/useWideLayout';
import { cn } from '@/utils/cn';

type SessionExitSheetProps = {
  visible: boolean;
  onKeepGoing: () => void;
  onEndSession: () => void;
};

export function SessionExitSheet({ visible, onKeepGoing, onEndSession }: SessionExitSheetProps) {
  const sheetFrame = useSheetFrame();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onKeepGoing}>
      <View className="flex-1 justify-end bg-black/50">
        <View
          className={cn(
            'gap-space-md rounded-t-radius-xl border-t border-border bg-surface px-space-lg pb-space-2xl pt-space-lg shadow-e3',
            sheetFrame.className,
          )}
          style={sheetFrame.style}>
          {/* The grabber the sheet has always implied but never drawn. */}
          <View className="h-1 w-10 self-center rounded-radius-full bg-border" />
          <Text className="text-title-lg font-ui-extrabold text-primary">End session?</Text>
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
