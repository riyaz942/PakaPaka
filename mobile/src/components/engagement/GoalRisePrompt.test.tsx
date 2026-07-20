import { fireEvent, render, screen } from '@testing-library/react-native';

import { GoalReductionPrompt, GoalRisePrompt } from './GoalRisePrompt';

describe('GoalRisePrompt', () => {
  it('congratulates and shows both goals', () => {
    render(
      <GoalRisePrompt
        proposedGoal={45}
        currentGoal={30}
        onAccept={jest.fn()}
        onAdjust={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByTestId('goal-rise-prompt')).toBeTruthy();
    expect(screen.getByText(/raise it to 45/i)).toBeTruthy();
  });

  it('fires the right callback per action', () => {
    const onAccept = jest.fn();
    const onAdjust = jest.fn();
    const onDismiss = jest.fn();
    render(
      <GoalRisePrompt
        proposedGoal={45}
        currentGoal={30}
        onAccept={onAccept}
        onAdjust={onAdjust}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.press(screen.getByTestId('goal-rise-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('goal-rise-adjust'));
    expect(onAdjust).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('goal-rise-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('GoalReductionPrompt', () => {
  it('offers the lower goal with kindness framing', () => {
    render(
      <GoalReductionPrompt
        proposedGoal={20}
        currentGoal={50}
        onAccept={jest.fn()}
        onDecline={jest.fn()}
      />,
    );
    expect(screen.getByTestId('goal-reduction-prompt')).toBeTruthy();
    expect(screen.getByText('Been a tough stretch?')).toBeTruthy();
  });

  it('fires accept and decline callbacks', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    render(
      <GoalReductionPrompt
        proposedGoal={20}
        currentGoal={50}
        onAccept={onAccept}
        onDecline={onDecline}
      />,
    );

    fireEvent.press(screen.getByTestId('goal-reduction-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('goal-reduction-decline'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
