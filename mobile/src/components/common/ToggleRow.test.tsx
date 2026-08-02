import { fireEvent, render, screen } from '@testing-library/react-native';

import { ToggleRow } from './ToggleRow';

describe('ToggleRow', () => {
  it('toggles to the opposite value on press', () => {
    const onValueChange = jest.fn();
    render(
      <ToggleRow
        label="Lightning Mode"
        value={false}
        onValueChange={onValueChange}
        testID="lightning"
      />,
    );

    fireEvent.press(screen.getByTestId('lightning'));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('exposes switch semantics with the checked state', () => {
    render(
      <ToggleRow
        label="Vacation mode"
        description="Reviews pause until you come back."
        value
        onValueChange={jest.fn()}
        testID="vacation"
      />,
    );

    const row = screen.getByTestId('vacation');
    expect(row.props.accessibilityRole).toBe('switch');
    expect(row.props.accessibilityState).toMatchObject({ checked: true });
    expect(row.props.accessibilityHint).toBe('Reviews pause until you come back.');
  });

  it('fills the track with jade when on and leaves it neutral when off', () => {
    const { rerender } = render(
      <ToggleRow label="Bias" value onValueChange={jest.fn()} testID="bias" />,
    );
    expect(screen.getByTestId('bias-track').props.className).toContain('bg-brand-600');

    rerender(<ToggleRow label="Bias" value={false} onValueChange={jest.fn()} testID="bias" />);
    expect(screen.getByTestId('bias-track').props.className).toContain('bg-surface-elevated');
  });

  it('does not fire while disabled', () => {
    const onValueChange = jest.fn();
    render(
      <ToggleRow
        label="Bias"
        value={false}
        onValueChange={onValueChange}
        disabled
        testID="bias"
      />,
    );

    fireEvent.press(screen.getByTestId('bias'));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
