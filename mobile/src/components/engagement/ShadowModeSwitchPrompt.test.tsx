import { fireEvent, render, screen } from '@testing-library/react-native';

import { ShadowModeSwitchPrompt } from './ShadowModeSwitchPrompt';

describe('ShadowModeSwitchPrompt', () => {
  it('renders the day count in the headline and accessible label', () => {
    render(
      <ShadowModeSwitchPrompt
        daysActive={14}
        onCommit={jest.fn()}
        onSnooze={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText("You've been comparing for 14 days")).toBeTruthy();
    expect(
      screen.getByLabelText("You've been comparing for 14 days. Ready to switch fully?"),
    ).toBeTruthy();
  });

  it('fires onCommit when "I\'m ready to switch" is pressed', () => {
    const onCommit = jest.fn();
    render(
      <ShadowModeSwitchPrompt
        daysActive={14}
        onCommit={onCommit}
        onSnooze={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('shadow-mode-switch-prompt-commit'));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('fires onSnooze when "Remind me later" is pressed', () => {
    const onSnooze = jest.fn();
    render(
      <ShadowModeSwitchPrompt
        daysActive={20}
        onCommit={jest.fn()}
        onSnooze={onSnooze}
        onDismiss={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('shadow-mode-switch-prompt-snooze'));
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });

  it('fires onDismiss when "Don\'t show again" is pressed', () => {
    const onDismiss = jest.fn();
    render(
      <ShadowModeSwitchPrompt
        daysActive={20}
        onCommit={jest.fn()}
        onSnooze={jest.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.press(screen.getByTestId('shadow-mode-switch-prompt-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('every button has an accessibility role and label', () => {
    render(
      <ShadowModeSwitchPrompt
        daysActive={14}
        onCommit={jest.fn()}
        onSnooze={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: "I'm ready to switch fully" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remind me later' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Don't show this again" })).toBeTruthy();
  });
});
