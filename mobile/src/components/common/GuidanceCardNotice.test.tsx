import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { GuidanceCardNotice } from '@/components/common/GuidanceCardNotice';
import { GUIDANCE_CARD_BY_ID } from '@/components/onboarding/cardRegistry';

describe('GuidanceCardNotice', () => {
  it('renders the card title and body inline', () => {
    render(
      <GuidanceCardNotice card={GUIDANCE_CARD_BY_ID['first-miss']} onDismiss={jest.fn()} />,
    );

    expect(screen.getByTestId('guidance-card-notice')).toBeTruthy();
    expect(screen.getByTestId('guidance-card-notice-first-miss')).toBeTruthy();
    expect(screen.getByText('Getting it wrong is the point')).toBeTruthy();
    expect(screen.getByText(/not a strike against you/)).toBeTruthy();
  });

  it('passes the subject through to the card', () => {
    render(
      <GuidanceCardNotice
        card={GUIDANCE_CARD_BY_ID['spaced-repetition']}
        subject="水"
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText(/水/)).toBeTruthy();
  });

  it('is announced politely when it appears on its own', () => {
    render(
      <GuidanceCardNotice card={GUIDANCE_CARD_BY_ID['first-miss']} onDismiss={jest.fn()} />,
    );

    expect(screen.getByTestId('guidance-card-notice').props.accessibilityLiveRegion).toBe(
      'polite',
    );
  });

  it('dismisses in one tap from a 44pt control', () => {
    const onDismiss = jest.fn();
    render(
      <GuidanceCardNotice card={GUIDANCE_CARD_BY_ID['passage-locks']} onDismiss={onDismiss} />,
    );

    const dismiss = screen.getByTestId('guidance-card-notice-dismiss');
    expect(dismiss.props.accessibilityLabel).toBe('Dismiss');
    expect(dismiss.props.className).toContain('min-h-[44px]');

    fireEvent.press(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
