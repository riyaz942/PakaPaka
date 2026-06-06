import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ItemStudyStatusPicker } from '@/components/onboarding/ItemStudyStatusPicker';

describe('ItemStudyStatusPicker', () => {
  it('renders radiogroup with three radio options', () => {
    render(
      <ItemStudyStatusPicker
        selectedStatus="not_started"
        onSelect={jest.fn()}
        testID="status-picker"
      />,
    );

    expect(screen.getByTestId('status-picker').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByText('Known')).toBeTruthy();
    expect(screen.getByText('In progress')).toBeTruthy();
    expect(screen.getByText('Not started')).toBeTruthy();
  });

  it('calls onSelect when an option is pressed', () => {
    const onSelect = jest.fn();

    render(
      <ItemStudyStatusPicker
        selectedStatus="not_started"
        onSelect={onSelect}
        testID="status-picker"
      />,
    );

    fireEvent.press(screen.getByTestId('status-picker-known'));
    expect(onSelect).toHaveBeenCalledWith('known');
  });

  it('marks the selected option with accessibilityState', () => {
    render(
      <ItemStudyStatusPicker
        selectedStatus="in_progress"
        onSelect={jest.fn()}
        testID="status-picker"
      />,
    );

    expect(screen.getByTestId('status-picker-in_progress').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByTestId('status-picker-known').props.accessibilityState).toEqual({
      selected: false,
    });
  });
});
