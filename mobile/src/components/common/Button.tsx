import { forwardRef } from 'react';
import { Pressable, Text, type View } from 'react-native';

import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  className?: string;
};

const variantClasses: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-feedback-info',
    // Fixed white on the filled accent — theme text tokens flip to near-black
    // in light mode and vanish against the blue fill.
    text: 'text-white font-semibold',
  },
  secondary: {
    container: 'bg-surface-elevated border border-border',
    text: 'text-primary font-semibold',
  },
  tertiary: {
    container: 'bg-surface border border-border',
    text: 'text-primary font-medium',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-secondary font-medium',
  },
  destructive: {
    container: 'bg-feedback-error',
    text: 'text-white font-semibold',
  },
};

export const Button = forwardRef<View, ButtonProps>(function Button(
  {
    label,
    onPress,
    variant = 'primary',
    disabled = false,
    accessibilityLabel,
    testID,
    className,
  },
  ref,
) {
  const styles = variantClasses[variant];

  return (
    <Pressable
      ref={ref}
      focusable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      className={cn(
        'min-h-[44px] items-center justify-center rounded-radius-md px-4 py-3',
        styles.container,
        disabled && 'opacity-40',
        className,
      )}>
      <Text className={cn('text-body', styles.text)}>{label}</Text>
    </Pressable>
  );
});
