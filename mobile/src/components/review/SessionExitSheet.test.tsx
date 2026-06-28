import { fireEvent, render, screen } from '@testing-library/react-native';

import { SessionExitSheet } from './SessionExitSheet';

describe('SessionExitSheet', () => {
  const defaultProps = {
    visible: true,
    onKeepGoing: jest.fn(),
    onEndSession: jest.fn(),
  };

  it('is not visible when visible=false', () => {
    render(<SessionExitSheet {...defaultProps} visible={false} />);
    expect(screen.queryByText('End session?')).toBeNull();
  });

  it('shows title when visible', () => {
    render(<SessionExitSheet {...defaultProps} />);
    expect(screen.getByText('End session?')).toBeTruthy();
  });

  it('shows body copy about saved progress', () => {
    render(<SessionExitSheet {...defaultProps} />);
    expect(screen.getByText('Progress is saved.')).toBeTruthy();
  });

  it('calls onKeepGoing when Keep going is pressed', () => {
    const onKeepGoing = jest.fn();
    render(<SessionExitSheet {...defaultProps} onKeepGoing={onKeepGoing} />);
    fireEvent.press(screen.getByText('Keep going'));
    expect(onKeepGoing).toHaveBeenCalledTimes(1);
  });

  it('calls onEndSession when End session is pressed', () => {
    const onEndSession = jest.fn();
    render(<SessionExitSheet {...defaultProps} onEndSession={onEndSession} />);
    fireEvent.press(screen.getByText('End session'));
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });
});
