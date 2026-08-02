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

/**
 * Design System v2 buttons. Weight comes from the font utility, not `font-bold`
 * — the static Google Fonts register one family per weight.
 *
 * Every state carries a `shadow-*` utility, `shadow-none` included. NativeWind
 * compiles shadows to a rule that declares a CSS variable, and a class that
 * starts declaring variables *after* the first render makes the css-interop
 * wrap the element in a provider — which remounts it. A button that toggles
 * `disabled` would otherwise gain/lose the glow and remount mid-session.
 */
const variantClasses: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    // brand-600, not the brand-500 the spec draws: white on 500 is 3.39:1.
    container: 'bg-brand-600 shadow-cta-glow',
    text: 'text-on-primary font-ui-bold',
  },
  secondary: {
    container: 'border-[1.5px] border-brand-500 bg-surface shadow-none',
    text: 'text-brand-text font-ui-bold',
  },
  tertiary: {
    container: 'bg-surface-elevated shadow-none',
    text: 'text-secondary font-ui-bold',
  },
  ghost: {
    container: 'bg-transparent shadow-none',
    text: 'text-muted font-ui-semibold',
  },
  destructive: {
    container: 'bg-feedback-incorrect-fill shadow-none',
    text: 'text-on-primary font-ui-bold',
  },
};

/**
 * Disabled reads grey, never a faded brand tint — onboarding step 1 waits in
 * this state and a tinted one would look like a live CTA (spec, Buttons).
 */
const disabledClasses = {
  container: 'bg-surface-elevated shadow-none',
  text: 'text-faint font-ui-bold',
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
  const styles = disabled ? disabledClasses : variantClasses[variant];

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
        'min-h-[48px] items-center justify-center rounded-radius-md px-space-lg py-space-md',
        styles.container,
        className,
      )}>
      <Text className={cn('text-body', styles.text)}>{label}</Text>
    </Pressable>
  );
});
