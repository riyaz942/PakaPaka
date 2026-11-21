import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

type BrowseOnlyIntroModalProps = {
  browsePending: boolean;
  onBrowse(): void;
  onUseHere(): void;
};

/**
 * Web: shown each time a second tab opens while another tab owns the
 * databases. It has no close control; the user picks Browse or Use here.
 * It is drawn in place of the app (not an RN Modal), so Escape and the
 * backdrop cannot dismiss it.
 */
export function BrowseOnlyIntroModal({
  browsePending,
  onBrowse,
  onUseHere,
}: BrowseOnlyIntroModalProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-space-md">
      <View
        accessibilityViewIsModal
        className="w-full max-w-lg gap-space-md rounded-radius-lg border border-border bg-surface p-space-lg">
        <Text accessibilityRole="header" className="text-center text-title font-ui-bold text-primary">
          PakaPaka is already open in another tab
        </Text>
        <Text className="text-body text-secondary">
          Only one tab can save your progress. So this tab cannot run reviews or lessons right now.
        </Text>

        <View className="gap-space-xs">
          <Text className="text-body font-ui-bold text-primary">Browse</Text>
          <Text className="text-body text-secondary">
            Look up kanji, words and passages in this tab. Your review in the other tab keeps
            going. Progress here is from when this tab opened.
          </Text>
        </View>

        <View className="gap-space-xs">
          <Text className="text-body font-ui-bold text-primary">Use here</Text>
          <Text className="text-body text-secondary">
            Move PakaPaka to this tab. The other tab stops. Answers you gave there are saved.
          </Text>
        </View>

        <View className="flex-row items-center justify-center gap-space-md pt-space-sm">
          {browsePending ? (
            <ActivityIndicator testID="browse-pending-spinner" accessibilityLabel="Loading" />
          ) : null}
          <Button label="Browse" onPress={onBrowse} disabled={browsePending} />
          <Button label="Use here" onPress={onUseHere} variant="secondary" />
        </View>
      </View>
    </View>
  );
}
