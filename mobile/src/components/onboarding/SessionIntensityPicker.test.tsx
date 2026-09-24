import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { COGNITIVE_LOAD_THRESHOLD_BASE } from '@/config/constants';
import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';
import { SESSION_INTENSITY_VALUES } from '@/data/user/sessionIntensity.types';

describe('SessionIntensityPicker', () => {
  it('renders radiogroup with five radio options', () => {
    render(
      <SessionIntensityPicker
        selectedIntensity={null}
        onSelect={jest.fn()}
        testID="intensity-picker"
      />,
    );

    expect(screen.getByTestId('intensity-picker')).toBeTruthy();
    expect(screen.getByTestId('intensity-picker').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Relaxed')).toBeTruthy();
    expect(screen.getByText('Steady')).toBeTruthy();
    expect(screen.getByText('Intense')).toBeTruthy();
    expect(screen.getByText('Immersive')).toBeTruthy();
  });

  it('derives each sublabel from the daily goal map', () => {
    render(
      <SessionIntensityPicker
        selectedIntensity={null}
        onSelect={jest.fn()}
        testID="intensity-picker"
      />,
    );

    for (const intensity of SESSION_INTENSITY_VALUES) {
      const items = COGNITIVE_LOAD_THRESHOLD_BASE[intensity];
      expect(screen.getByText(`${items} items/day · lessons + reviews`)).toBeTruthy();
    }
  });

  it('pins the daily goal for each tier', () => {
    expect(COGNITIVE_LOAD_THRESHOLD_BASE).toEqual({
      light: 8,
      relaxed: 15,
      steady: 21,
      intense: 28,
      immersive: 40,
    });
  });

  it('badges only Relaxed as recommended for new learners', () => {
    render(
      <SessionIntensityPicker
        selectedIntensity={null}
        onSelect={jest.fn()}
        testID="intensity-picker"
      />,
    );

    expect(screen.getAllByText('Recommended for new learners')).toHaveLength(1);
  });

  it('calls onSelect for a newly added tier', () => {
    const onSelect = jest.fn();

    render(
      <SessionIntensityPicker
        selectedIntensity={null}
        onSelect={onSelect}
        testID="intensity-picker"
      />,
    );

    fireEvent.press(screen.getByTestId('intensity-picker-immersive'));
    expect(onSelect).toHaveBeenCalledWith('immersive');
  });

  it('calls onSelect when an option is pressed', () => {
    const onSelect = jest.fn();

    render(
      <SessionIntensityPicker
        selectedIntensity={null}
        onSelect={onSelect}
        testID="intensity-picker"
      />,
    );

    fireEvent.press(screen.getByTestId('intensity-picker-intense'));
    expect(onSelect).toHaveBeenCalledWith('intense');
  });

  it('marks the selected option with accessibilityState', () => {
    render(
      <SessionIntensityPicker
        selectedIntensity="relaxed"
        onSelect={jest.fn()}
        testID="intensity-picker"
      />,
    );

    const relaxedOption = screen.getByTestId('intensity-picker-relaxed');
    const intenseOption = screen.getByTestId('intensity-picker-intense');

    expect(relaxedOption.props.accessibilityState).toEqual({ selected: true, checked: true });
    expect(intenseOption.props.accessibilityState).toEqual({ selected: false, checked: false });
  });
});
