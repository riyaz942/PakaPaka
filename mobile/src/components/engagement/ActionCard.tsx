import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { cn } from '@/utils/cn';

type ActionCardProps = {
  title: string;
  subtitle: string;
  glyph: string;
  onPress: () => void;
  accent?: boolean;
  disabled?: boolean;
  /** Dimmed but still tappable — for advisory states like the lesson cap. */
  muted?: boolean;
  accessibilityLabel: string;
  testID?: string;
};

/**
 * Home's two CTAs. Review is the accented one (2px jade border, jade fill, jade
 * glyph square); the lesson card stays a plain resting surface, so the review-
 * first hierarchy of UX-DR3 is carried by weight rather than by order alone.
 */
export function ActionCard({
  title,
  subtitle,
  glyph,
  onPress,
  accent = false,
  disabled = false,
  muted = false,
  accessibilityLabel,
  testID,
}: ActionCardProps) {
  return (
    <PressableScale
      focusable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      className={cn(
        'min-h-[44px] flex-row items-center gap-space-md rounded-radius-lg p-space-md',
        accent
          ? 'border-2 border-brand-500 bg-brand-soft'
          : 'border border-border bg-surface shadow-e1',
        disabled && 'opacity-40',
        muted && 'opacity-60',
      )}>
      <View
        className={cn(
          'h-[42px] w-[42px] items-center justify-center rounded-radius-md',
          accent ? 'bg-brand-600' : 'bg-surface-elevated',
        )}>
        <Text
          className={cn(
            'text-title font-jp-hero-bold',
            accent ? 'text-on-primary' : 'text-primary',
          )}>
          {glyph}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-body font-ui-extrabold text-primary">{title}</Text>
        <Text
          className={cn(
            'mt-space-xs text-body-sm font-ui-semibold',
            accent ? 'text-brand-text' : 'text-muted',
          )}>
          {subtitle}
        </Text>
      </View>
      <Icon
        name="chevron"
        size={18}
        strokeWidth={2.4}
        className={accent ? 'text-brand-text' : 'text-faint'}
      />
    </PressableScale>
  );
}
