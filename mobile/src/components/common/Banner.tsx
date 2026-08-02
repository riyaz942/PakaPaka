import React, { useEffect } from 'react';
import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/common/Icon';
import { cn } from '@/utils/cn';

export type BannerVariant = 'success' | 'error' | 'info' | 'warning';

type BannerProps = {
  message: string;
  variant?: BannerVariant;
  visible: boolean;
  autoDismissMs?: number;
  onDismiss?: () => void;
  className?: string;
  testID?: string;
};

/**
 * The v2 banner slot: soft fill, drawn icon, one line of deep-toned copy. Only
 * ever one on screen at a time — screens pick their single most useful message
 * rather than stacking notices.
 *
 * `info` is the jade house style the spec uses for guidance; the other three
 * carry their feedback family's soft fill.
 */
const variantStyles: Record<BannerVariant, { container: string; content: string; icon: IconName }> =
  {
    info: { container: 'bg-brand-soft', content: 'text-brand-text', icon: 'info' },
    success: {
      container: 'bg-feedback-correct-soft',
      content: 'text-feedback-correct-deep',
      icon: 'correct',
    },
    warning: {
      container: 'bg-feedback-warning-soft',
      content: 'text-feedback-warning-deep',
      icon: 'info',
    },
    error: {
      container: 'bg-feedback-incorrect-soft',
      content: 'text-feedback-incorrect-deep',
      icon: 'info',
    },
  };

export function Banner({
  message,
  variant = 'info',
  visible,
  autoDismissMs,
  onDismiss,
  className,
  testID,
}: BannerProps) {
  useEffect(() => {
    if (!visible || !autoDismissMs || !onDismiss) {
      return;
    }

    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [visible, autoDismissMs, onDismiss]);

  if (!visible) {
    return null;
  }

  const styles = variantStyles[variant];

  return (
    <View
      testID={testID}
      className={cn(
        'flex-row items-center gap-space-sm rounded-radius-md px-space-md py-space-sm',
        styles.container,
        className,
      )}
      accessibilityRole="alert">
      <Icon name={styles.icon} size={20} strokeWidth={2} className={styles.content} />
      <Text className={cn('flex-1 text-body-sm font-ui-semibold', styles.content)}>{message}</Text>
    </View>
  );
}
