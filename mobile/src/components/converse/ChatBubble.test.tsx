import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import React from 'react';

import { ChatBubble } from '@/components/converse/ChatBubble';
import type { PassageWordSpan } from '@/data/curriculum/passageSpans';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

let mockOverrides = new Map<string, 'shown' | 'hidden'>();
const mockSetOverride = jest.fn((itemId: string, mode: 'shown' | 'hidden') => {
  mockOverrides.set(itemId, mode);
});
const modeForItem = (itemId: string | null | undefined) =>
  (itemId ? mockOverrides.get(itemId) : null) ?? 'shown';

const furiganaProps = {
  furiganaMode: 'shown',
  modeForItem,
  setOverride: mockSetOverride,
} as const;

/** 来ます — a taught inflection whose span resolves to the base word 来る (14.1a). */
const inflectedSpan: PassageWordSpan[] = [
  { vocabularyItemId: 'kuru-v', startOffset: 5, endOffset: 8, inflection: 'masu' },
];

describe('ChatBubble', () => {
  beforeEach(() => {
    mockSetOverride.mockClear();
    (router.push as jest.Mock).mockClear();
    mockOverrides = new Map();
  });

  it('renders an assistant reply through the furigana pipeline (FR91)', () => {
    render(<ChatBubble role="assistant" text="私[わたし]は学生[がくせい]です。" {...furiganaProps} />);

    // parseFurigana splits the run, so the reading renders as its own node
    // above the kanji rather than as literal bracket text.
    expect(screen.getByText('わたし')).toBeTruthy();
    expect(screen.getByText('がくせい')).toBeTruthy();
    expect(screen.queryByText(/\[わたし\]/)).toBeNull();
  });

  it('renders malformed brackets as plain text with no error surfaced (OA6)', () => {
    const malformed = '壊[こわ れた';

    expect(() =>
      render(<ChatBubble role="assistant" text={malformed} {...furiganaProps} />),
    ).not.toThrow();
    expect(screen.getByText(malformed)).toBeTruthy();
  });

  it('offers a visible non-gesture alternative to the long-press (NFR29)', () => {
    const onLookupWords = jest.fn();

    render(
      <ChatBubble
        role="assistant"
        text="私[わたし]です。"
        {...furiganaProps}
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
        {...furiganaProps}
        onLookupWords={onLookupWords}
      />,
    );

    fireEvent(screen.getByLabelText('私です。'), 'longPress');
    expect(onLookupWords).toHaveBeenCalledTimes(1);
  });

  it("renders the learner's own turn as plain text with no lookup affordance", () => {
    render(<ChatBubble role="user" text="こんにちは" {...furiganaProps} />);

    expect(screen.getByText('こんにちは')).toBeTruthy();
    expect(screen.queryByTestId('chat-bubble-lookup')).toBeNull();
  });

  it('omits the lookup affordance when no handler is supplied (streaming preview)', () => {
    render(<ChatBubble role="assistant" text="元気[げんき]" {...furiganaProps} />);

    expect(screen.queryByTestId('chat-bubble-lookup')).toBeNull();
  });

  describe('word linking (15.1 / 15.2)', () => {
    const text = '猫[ねこ]がここへ来[き]ます。';

    it('renders the reply unsegmented when nothing in it is a curriculum word', () => {
      render(<ChatBubble role="assistant" text={text} {...furiganaProps} wordSpans={[]} />);

      expect(screen.queryByTestId('chat-bubble-linked')).toBeNull();
    });

    it('tap on a linked word opens the base word, naming the surface that sent it (14.1)', () => {
      render(
        <ChatBubble role="assistant" text={text} {...furiganaProps} wordSpans={inflectedSpan} />,
      );

      fireEvent.press(screen.getByTestId('chat-word-kuru-v-1'));

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/browse/item/kuru-v',
        params: { surface: '来ます', inflection: 'masu' },
      });
      expect(mockSetOverride).not.toHaveBeenCalled();
    });

    it('tap on a dictionary-form word opens it with no surface note', () => {
      render(
        <ChatBubble
          role="assistant"
          text={text}
          {...furiganaProps}
          wordSpans={[{ vocabularyItemId: 'neko-n', startOffset: 0, endOffset: 1, inflection: null }]}
        />,
      );

      fireEvent.press(screen.getByTestId('chat-word-neko-n-0'));

      expect(router.push).toHaveBeenCalledWith('/browse/item/neko-n');
    });

    it('long-press on a linked word toggles its furigana instead of opening details', () => {
      render(
        <ChatBubble role="assistant" text={text} {...furiganaProps} wordSpans={inflectedSpan} />,
      );

      fireEvent(screen.getByTestId('chat-word-kuru-v-1'), 'longPress');

      expect(mockSetOverride).toHaveBeenCalledWith('kuru-v', 'hidden');
      expect(router.push).not.toHaveBeenCalled();
    });

    it('long-press shows furigana again when the word is currently hidden', () => {
      mockOverrides = new Map([['kuru-v', 'hidden']]);

      render(
        <ChatBubble role="assistant" text={text} {...furiganaProps} wordSpans={inflectedSpan} />,
      );

      fireEvent(screen.getByTestId('chat-word-kuru-v-1'), 'longPress');

      expect(mockSetOverride).toHaveBeenCalledWith('kuru-v', 'shown');
    });

    it('keeps the whole reply as one screen-reader element and the sheet reachable (NFR29)', () => {
      const onLookupWords = jest.fn();

      render(
        <ChatBubble
          role="assistant"
          text={text}
          {...furiganaProps}
          wordSpans={inflectedSpan}
          onLookupWords={onLookupWords}
        />,
      );

      // The bubble still reads as a sentence, and long-pressing it anywhere but
      // a linked word still opens the lookup sheet.
      fireEvent(screen.getByLabelText('猫がここへ来ます。'), 'longPress');
      expect(onLookupWords).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('chat-bubble-lookup')).toBeTruthy();
    });
  });
});
