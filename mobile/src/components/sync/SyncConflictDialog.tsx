import { useMemo } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { getItemBySlug } from '@/data/curriculum/itemRepository';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useSheetFrame } from '@/hooks/useWideLayout';
import { useSync } from '@/providers/SyncProvider';
import { cn } from '@/utils/cn';

function formatChanged(iso: string | null): string {
  return iso === null ? 'removed' : new Date(iso).toLocaleString();
}

/**
 * Opens when two devices changed the same item. A run waits for the answer, so
 * the back gesture does nothing: the learner picks one side.
 */
export function SyncConflictDialog() {
  const sheetFrame = useSheetFrame();
  const { curriculumDb } = useDatabase();
  const { conflicts, chooseConflict } = useSync();

  const titles = useMemo(
    () =>
      (conflicts ?? []).map((entry) => {
        if (entry.kind === 'preference') return `Setting: ${entry.key.replace(/_/g, ' ')}`;
        const found = getItemBySlug(curriculumDb, entry.item.itemType, entry.item.slug);
        return found ? `${found.primaryForm} · ${found.meaning}` : entry.item.slug;
      }),
    [conflicts, curriculumDb],
  );

  return (
    <Modal
      visible={conflicts !== null}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={() => {}}>
      <View className="flex-1 justify-end bg-black/50">
        <View
          className={cn(
            'gap-space-md rounded-t-radius-xl border-t border-border bg-surface px-space-lg pb-space-2xl pt-space-lg shadow-e3',
            sheetFrame.className,
          )}
          style={sheetFrame.style}
          testID="sync-conflict-dialog">
          <View className="h-1 w-10 self-center rounded-radius-full bg-border" />
          <Text className="text-title-lg font-ui-extrabold text-primary">
            Progress changed on two devices
          </Text>
          <Text className="text-body text-secondary">
            These items changed on this device and on another device. Choose which version to keep.
            All other changes are already merged.
          </Text>
          <ScrollView className="max-h-64 rounded-radius-md border border-border">
            {(conflicts ?? []).map((entry, index) => (
              <View
                key={index}
                className="border-b border-border px-space-md py-space-sm"
                testID={`sync-conflict-row-${index}`}>
                <Text className="text-body font-ui-semibold text-primary">{titles[index]}</Text>
                <Text className="mt-[3px] text-caption font-ui-medium text-muted">
                  {`This device: ${formatChanged(entry.localUpdatedAt)} · Other device: ${formatChanged(entry.remoteUpdatedAt)}`}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View className="gap-space-sm pt-space-sm">
            <Button
              label="Keep this device"
              onPress={() => chooseConflict('local')}
              testID="sync-conflict-keep-local"
            />
            <Button
              label="Use other device"
              variant="secondary"
              onPress={() => chooseConflict('remote')}
              testID="sync-conflict-use-remote"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
