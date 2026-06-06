import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';

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

function ProgressDots({ stepIndex, stepCount }: { stepIndex: number; stepCount: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${stepIndex} of ${stepCount}`}
      className="mb-6 flex-row items-center justify-center gap-2">
      {Array.from({ length: stepCount }, (_, index) => {
        const isActive = index + 1 === stepIndex;
        return (
          <View
            key={index}
            className={cn(
              'h-2 w-2 rounded-radius-full',
              isActive ? 'bg-feedback-info' : 'bg-border',
            )}
          />
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

      <Text accessibilityRole="header" className="text-title-lg text-primary">
        {title}
      </Text>

      {description ? (
        <Text className="mt-2 text-body-sm text-secondary">{description}</Text>
      ) : null}

      <View className="mt-8 flex-1">{children}</View>

      <View className="gap-3">
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
