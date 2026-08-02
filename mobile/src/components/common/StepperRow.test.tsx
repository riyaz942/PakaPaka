import { fireEvent, render, screen } from '@testing-library/react-native';

import { StepperRow } from './StepperRow';

describe('StepperRow', () => {
  it('steps the value in both directions', () => {
    const onValueChange = jest.fn();
    render(
      <StepperRow
        label="Daily goal"
        value={30}
        step={5}
        onValueChange={onValueChange}
        testID="goal"
      />,
    );

    fireEvent.press(screen.getByTestId('goal-increment'));
    expect(onValueChange).toHaveBeenCalledWith(35);

    fireEvent.press(screen.getByTestId('goal-decrement'));
    expect(onValueChange).toHaveBeenCalledWith(25);
  });

  it('disables the decrement at the minimum rather than clamping silently', () => {
    const onValueChange = jest.fn();
    render(
      <StepperRow label="Daily goal" value={5} min={5} onValueChange={onValueChange} testID="goal" />,
    );

    const decrement = screen.getByTestId('goal-decrement');
    expect(decrement.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(decrement);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('leaves the increment live when there is no upper limit', () => {
    render(<StepperRow label="Daily goal" value={999} onValueChange={jest.fn()} testID="goal" />);
    expect(screen.getByTestId('goal-increment').props.accessibilityState).toMatchObject({
      disabled: false,
    });
  });

  it('announces the value with its unit', () => {
    render(
      <StepperRow
        label="Daily goal"
        value={30}
        unitLabel="load units"
        onValueChange={jest.fn()}
        testID="goal"
      />,
    );

    expect(screen.getByLabelText('Daily goal: 30 load units')).toBeTruthy();
  });
});
