import { fireEvent, render, screen } from '@testing-library/react-native';

import { FuriganaText } from '@/components/common/FuriganaText';

const SENTENCE = '食[た]べる';

describe('FuriganaText', () => {
  it('renders plain text when there are no bracket annotations', () => {
    render(<FuriganaText text="たべる" mode="shown" />);
    expect(screen.getByText('たべる')).toBeTruthy();
  });

  it('shows the reading in "shown" mode', () => {
    render(<FuriganaText text={SENTENCE} mode="shown" />);
    expect(screen.getByText('た')).toBeTruthy();
    expect(screen.getByText('食')).toBeTruthy();
  });

  it('hides the reading in "hidden" mode', () => {
    render(<FuriganaText text={SENTENCE} mode="hidden" />);
    expect(screen.queryByText('た')).toBeNull();
    expect(screen.getByText('食')).toBeTruthy();
  });

  it('in "auto" mode, hides the reading only when the kanji is known', () => {
    const { rerender } = render(
      <FuriganaText text={SENTENCE} mode="auto" knownKanji={new Set()} />,
    );
    expect(screen.getByText('た')).toBeTruthy();

    rerender(<FuriganaText text={SENTENCE} mode="auto" knownKanji={new Set(['食'])} />);
    expect(screen.queryByText('た')).toBeNull();
  });

  it('tapping a segment toggles its reading visibility', () => {
    render(<FuriganaText text={SENTENCE} mode="hidden" />);
    expect(screen.queryByText('た')).toBeNull();

    fireEvent.press(screen.getByText('食'));
    expect(screen.getByText('た')).toBeTruthy();

    fireEvent.press(screen.getByText('食'));
    expect(screen.queryByText('た')).toBeNull();
  });

  it('does not toggle readings when interactive is false', () => {
    render(<FuriganaText text={SENTENCE} mode="hidden" interactive={false} />);
    expect(screen.queryByText('た')).toBeNull();

    fireEvent.press(screen.getByText('食'));
    expect(screen.queryByText('た')).toBeNull();
  });

  it('sets the container accessibility label to the plain stripped text', () => {
    render(<FuriganaText text="私[わたし]は学生[がくせい]です。" mode="shown" />);
    expect(screen.getByLabelText('私は学生です。')).toBeTruthy();
  });

  it('resets manual toggles when the text prop changes', () => {
    const { rerender } = render(<FuriganaText text={SENTENCE} mode="hidden" />);
    fireEvent.press(screen.getByText('食'));
    expect(screen.getByText('た')).toBeTruthy();

    rerender(<FuriganaText text="飲[の]む" mode="hidden" />);
    expect(screen.queryByText('の')).toBeNull();
  });

  // BUG6 / FR78: when the caller is rendering exactly one vocabulary item's own
  // word, mastery of *that word* decides — not whether its component kanji
  // happen to be known.
  describe('isKnownWord (Tier 1: the item\'s own word)', () => {
    it('hides the reading for a mastered word even with no known kanji', () => {
      render(
        <FuriganaText text={SENTENCE} mode="auto" knownKanji={new Set()} isKnownWord />,
      );
      expect(screen.queryByText('た')).toBeNull();
    });

    it('shows the reading for an unmastered word even when its kanji are known', () => {
      render(
        <FuriganaText
          text={SENTENCE}
          mode="auto"
          knownKanji={new Set(['食'])}
          isKnownWord={false}
        />,
      );
      expect(screen.getByText('た')).toBeTruthy();
    });

    it('falls back to the per-character check when isKnownWord is not supplied', () => {
      render(<FuriganaText text={SENTENCE} mode="auto" knownKanji={new Set(['食'])} />);
      expect(screen.queryByText('た')).toBeNull();
    });

    it('is ignored under an explicit shown/hidden mode', () => {
      const { rerender } = render(
        <FuriganaText text={SENTENCE} mode="shown" isKnownWord />,
      );
      expect(screen.getByText('た')).toBeTruthy();

      rerender(<FuriganaText text={SENTENCE} mode="hidden" isKnownWord={false} />);
      expect(screen.queryByText('た')).toBeNull();
    });

    it('keeps the stateless peek working on a mastered word', () => {
      render(<FuriganaText text={SENTENCE} mode="auto" isKnownWord />);
      expect(screen.queryByText('た')).toBeNull();

      fireEvent.press(screen.getByText('食'));
      expect(screen.getByText('た')).toBeTruthy();
    });
  });
});
