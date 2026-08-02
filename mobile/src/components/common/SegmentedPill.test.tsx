import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SegmentedPill, type SegmentedPillOption } from '@/components/common/SegmentedPill';

const OPTIONS: readonly SegmentedPillOption<'light' | 'dark' | 'system'>[] = [
  { value: 'light', label: 'Light', testID: 'pill-light' },
  { value: 'dark', label: 'Dark', testID: 'pill-dark' },
  { value: 'system', label: 'Auto', testID: 'pill-system' },
];

describe('SegmentedPill', () => {
  it('announces the group and marks only the current segment as selected', () => {
    render(
      <SegmentedPill
        accessibilityLabel="Theme"
        options={OPTIONS}
        value="dark"
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Theme').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByTestId('pill-dark').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('pill-light').props.accessibilityState.selected).toBe(false);
  });

  it('reports the pressed segment', () => {
    const onChange = jest.fn();
    render(
      <SegmentedPill
        accessibilityLabel="Theme"
        options={OPTIONS}
        value="dark"
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByTestId('pill-system'));
    expect(onChange).toHaveBeenCalledWith('system');
  });

  it('ignores presses while disabled', () => {
    const onChange = jest.fn();
    render(
      <SegmentedPill
        accessibilityLabel="Theme"
        disabled
        options={OPTIONS}
        value="dark"
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByTestId('pill-light'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('pill-light').props.accessibilityState.disabled).toBe(true);
  });
});
