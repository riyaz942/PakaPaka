import { render, screen, fireEvent } from '@testing-library/react-native';

import { DailyThresholdNotice } from './DailyThresholdNotice';

describe('DailyThresholdNotice', () => {
  it('renders copy when visible', () => {
    render(<DailyThresholdNotice visible />);
    expect(screen.getByText(/You've done enough for today/)).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    render(<DailyThresholdNotice visible={false} />);
    expect(screen.queryByText(/You've done enough for today/)).toBeNull();
  });

  it('has accessible alert role and label', () => {
    const { UNSAFE_getByProps } = render(<DailyThresholdNotice visible />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'alert' });
    expect(el).toBeTruthy();
    expect(el.props.accessibilityLabel).toContain("You've done enough for today");
  });

  it('calls onDismiss when dismiss is pressed', () => {
    const onDismiss = jest.fn();
    render(<DailyThresholdNotice visible onDismiss={onDismiss} />);
    fireEvent.press(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
