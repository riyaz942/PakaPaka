import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SessionIntensityPicker } from '@/components/onboarding/SessionIntensityPicker';

describe('SessionIntensityPicker', () => {
  it('renders radiogroup with two radio options', () => {
    render(
      <SessionIntensityPicker
        selectedIntensity={null}
        onSelect={jest.fn()}
        testID="intensity-picker"
      />,
    );

    expect(screen.getByTestId('intensity-picker')).toBeTruthy();
    expect(screen.getByTestId('intensity-picker').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByText('Relaxed')).toBeTruthy();
    expect(screen.getByText('Intense')).toBeTruthy();
    expect(screen.getByText('~15 min/day')).toBeTruthy();
    expect(screen.getByText('~30 min/day')).toBeTruthy();
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
