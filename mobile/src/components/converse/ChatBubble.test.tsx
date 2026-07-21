import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ChatBubble } from '@/components/converse/ChatBubble';

describe('ChatBubble', () => {
  it('renders an assistant reply through the furigana pipeline (FR91)', () => {
    render(
      <ChatBubble role="assistant" text="私[わたし]は学生[がくせい]です。" furiganaMode="shown" />,
    );

    // parseFurigana splits the run, so the reading renders as its own node
    // above the kanji rather than as literal bracket text.
    expect(screen.getByText('わたし')).toBeTruthy();
    expect(screen.getByText('がくせい')).toBeTruthy();
    expect(screen.queryByText(/\[わたし\]/)).toBeNull();
  });

  it('renders malformed brackets as plain text with no error surfaced (OA6)', () => {
    const malformed = '壊[こわ れた';

    expect(() =>
      render(<ChatBubble role="assistant" text={malformed} furiganaMode="shown" />),
    ).not.toThrow();
    expect(screen.getByText(malformed)).toBeTruthy();
  });

  it('offers a visible non-gesture alternative to the long-press (NFR29)', () => {
    const onLookupWords = jest.fn();

    render(
      <ChatBubble
        role="assistant"
        text="私[わたし]です。"
        furiganaMode="shown"
        onLookupWords={onLookupWords}
      />,
    );

    const button = screen.getByTestId('chat-bubble-lookup');
    expect(screen.getByLabelText('Look up words in this message')).toBeTruthy();

    fireEvent.press(button);
    expect(onLookupWords).toHaveBeenCalledTimes(1);
  });

  it('also opens lookup from the long-press gesture', () => {
    const onLookupWords = jest.fn();

    render(
      <ChatBubble
        role="assistant"
        text="私[わたし]です。"
        furiganaMode="shown"
        onLookupWords={onLookupWords}
      />,
    );

    fireEvent(screen.getByLabelText('私です。'), 'longPress');
    expect(onLookupWords).toHaveBeenCalledTimes(1);
  });

  it('renders the learner\'s own turn as plain text with no lookup affordance', () => {
    render(<ChatBubble role="user" text="こんにちは" furiganaMode="shown" />);

    expect(screen.getByText('こんにちは')).toBeTruthy();
    expect(screen.queryByTestId('chat-bubble-lookup')).toBeNull();
  });

  it('omits the lookup affordance when no handler is supplied (streaming preview)', () => {
    render(<ChatBubble role="assistant" text="元気[げんき]" furiganaMode="shown" />);

    expect(screen.queryByTestId('chat-bubble-lookup')).toBeNull();
  });
});
