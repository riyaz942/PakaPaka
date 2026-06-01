import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type BannerVariant = 'success' | 'error' | 'info' | 'warning';

type BannerProps = {
  message: string;
  variant?: BannerVariant;
  visible: boolean;
  autoDismissMs?: number;
  onDismiss?: () => void;
};

const variantClasses: Record<BannerVariant, string> = {
  success: 'bg-[#22CC88]',
  error: 'bg-red-600',
  info: 'bg-blue-600',
  warning: 'bg-amber-500',
};

export function Banner({
  message,
  variant = 'info',
  visible,
  autoDismissMs,
  onDismiss,
}: BannerProps) {
  const insets = useSafeAreaInsets();

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

  return (
    <View
      className={`px-4 py-3 ${variantClasses[variant]}`}
      style={{ paddingTop: insets.top + 12 }}
      accessibilityRole="alert"
    >
      <Text className="text-center text-sm font-medium text-[#0a0a0f]">{message}</Text>
    </View>
  );
}
