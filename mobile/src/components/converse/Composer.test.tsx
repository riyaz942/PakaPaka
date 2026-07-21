import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { Composer } from '@/components/converse/Composer';

describe('Composer', () => {
  it('sends the draft and clears it once the turn is accepted', async () => {
    const onSend = jest.fn().mockResolvedValue(true);
    render(<Composer onSend={onSend} />);

    fireEvent.changeText(screen.getByLabelText('Your message'), 'こんにちは');
    fireEvent.press(screen.getByTestId('composer-send'));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('こんにちは'));
    await waitFor(() => expect(screen.getByLabelText('Your message').props.value).toBe(''));
  });

  it('keeps the draft when the turn was rejected', async () => {
    const onSend = jest.fn().mockResolvedValue(false);
    render(<Composer onSend={onSend} />);

    fireEvent.changeText(screen.getByLabelText('Your message'), 'まだです');
    fireEvent.press(screen.getByTestId('composer-send'));

    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(screen.getByLabelText('Your message').props.value).toBe('まだです');
  });

  it('offers a mic button that promotes the session to conversation mode (FR90)', () => {
    const onMicPress = jest.fn();
    render(<Composer onSend={jest.fn()} onMicPress={onMicPress} />);

    fireEvent.press(screen.getByTestId('composer-mic'));

    expect(onMicPress).toHaveBeenCalledTimes(1);
  });

  it('shows no mic when the screen does not handle voice', () => {
    render(<Composer onSend={jest.fn()} />);

    expect(screen.queryByTestId('composer-mic')).toBeNull();
  });

  it('disables the mic along with the rest of the composer', () => {
    const onMicPress = jest.fn();
    render(<Composer onSend={jest.fn()} onMicPress={onMicPress} disabled />);

    const mic = screen.getByTestId('composer-mic');
    fireEvent.press(mic);

    expect(onMicPress).not.toHaveBeenCalled();
    expect(mic.props.accessibilityState.disabled).toBe(true);
  });

  it('labels the mic for screen readers', () => {
    render(<Composer onSend={jest.fn()} onMicPress={jest.fn()} />);

    expect(screen.getByLabelText('Speak instead of typing')).toBeTruthy();
  });
});
