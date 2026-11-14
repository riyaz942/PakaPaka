import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OnboardingStep } from '@/components/common/OnboardingStep';

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

function renderWithSafeArea(ui: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      {ui}
    </SafeAreaProvider>,
  );
}

describe('OnboardingStep', () => {
  it('renders title, primary action, and accessibility roles', () => {
    const onContinue = jest.fn();

    renderWithSafeArea(
      <OnboardingStep
        title="Where are you starting?"
        description="No account needed."
        stepIndex={1}
        stepCount={4}
        primaryAction={{ label: 'Continue', onPress: onContinue }}>
        <></>
      </OnboardingStep>,
    );

    expect(screen.getByText('Where are you starting?')).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();

    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeTruthy();

    fireEvent.press(continueButton);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
