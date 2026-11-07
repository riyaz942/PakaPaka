import React, { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';

type ActionConfig = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type OnboardingStepProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  primaryAction: ActionConfig;
  secondaryAction?: ActionConfig;
  skipAction?: ActionConfig;
  stepIndex?: number;
  stepCount?: number;
  testID?: string;
};

const DOT_PX = 8;
const ACTIVE_DOT_PX = 20;

/** The current step's dot stretches into a short bar as the step opens. */
function ActiveDot() {
  const { reducedMotion } = useReducedMotion();
  const width = useSharedValue(reducedMotion ? ACTIVE_DOT_PX : DOT_PX);
  useEffect(() => {
    width.value = reducedMotion ? ACTIVE_DOT_PX : withTiming(ACTIVE_DOT_PX, { duration: 280 });
  }, [reducedMotion, width]);
  const style = useAnimatedStyle(() => ({ width: width.value }));

  return <Animated.View className="h-2 rounded-radius-full bg-brand-500" style={style} />;
}

function ProgressDots({ stepIndex, stepCount }: { stepIndex: number; stepCount: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${stepIndex} of ${stepCount}`}
      className="mb-space-lg flex-row items-center justify-center gap-[7px]">
      {Array.from({ length: stepCount }, (_, index) => {
        return index + 1 === stepIndex ? (
          <ActiveDot key={index} />
        ) : (
          <View key={index} className="h-2 w-2 rounded-radius-full bg-border" />
        );
      })}
    </View>
  );
}

export function OnboardingStep({
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
  skipAction,
  stepIndex,
  stepCount,
  testID,
}: OnboardingStepProps) {
  const insets = useSafeAreaInsets();
  const showProgress = stepIndex !== undefined && stepCount !== undefined;

  return (
    <View
      testID={testID}
      className="flex-1 bg-background px-6"
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }}>
      {showProgress ? <ProgressDots stepIndex={stepIndex} stepCount={stepCount} /> : null}

      <Text
        accessibilityRole="header"
        className="text-title-lg font-ui-extrabold tracking-[-0.01em] text-primary">
        {title}
      </Text>

      {description ? (
        <Text className="mt-[9px] text-body-sm font-ui text-muted">{description}</Text>
      ) : null}

      <ScrollView className="mt-space-lg flex-1">{children}</ScrollView>

      <View className="gap-space-sm">
        <Button
          label={primaryAction.label}
          onPress={primaryAction.onPress}
          disabled={primaryAction.disabled}
          className="w-full"
          testID="onboarding-primary-action"
        />

        {secondaryAction ? (
          <Button
            label={secondaryAction.label}
            onPress={secondaryAction.onPress}
            disabled={secondaryAction.disabled}
            variant="secondary"
            className="w-full"
          />
        ) : null}

        {skipAction ? (
          <Button
            label={skipAction.label}
            onPress={skipAction.onPress}
            disabled={skipAction.disabled}
            variant="ghost"
            className="w-full"
          />
        ) : null}
      </View>
    </View>
  );
}
