import { fireEvent, render, screen } from '@testing-library/react-native';

import { ContentListRow } from './ContentListRow';

describe('ContentListRow', () => {
  it('opens the item on press', () => {
    const onPress = jest.fn();
    render(
      <ContentListRow
        rowType="kanji"
        glyph="一"
        title="one"
        onPress={onPress}
        accessibilityLabel="Kanji: 一, one"
        testID="row"
      />,
    );

    fireEvent.press(screen.getByTestId('row'));
    expect(onPress).toHaveBeenCalled();
  });

  it('edges the row in the content type colour', () => {
    render(
      <ContentListRow
        rowType="vocabulary"
        glyph="私"
        title="I / me"
        onPress={jest.fn()}
        accessibilityLabel="Vocabulary: 私, I / me"
        testID="row"
      />,
    );

    expect(screen.getByTestId('row-edge').props.className).toContain('bg-content-vocabulary');
  });

  it('shows the stage dot, and the type badge only when asked for one', () => {
    const { rerender } = render(
      <ContentListRow
        rowType="radical"
        glyph="一"
        title="ground / one"
        srsStage="guru"
        onPress={jest.fn()}
        accessibilityLabel="Radical: 一, ground / one"
        testID="row"
      />,
    );

    // Browse names the type in the caption, so the badge would repeat it.
    expect(screen.queryByText('RADICAL')).toBeNull();
    expect(screen.getByLabelText('SRS stage: Guru')).toBeTruthy();

    rerender(
      <ContentListRow
        rowType="radical"
        glyph="一"
        title="ground / one"
        showTypeBadge
        onPress={jest.fn()}
        accessibilityLabel="Radical: 一, ground / one"
        testID="row"
      />,
    );

    expect(screen.getByText('RADICAL')).toBeTruthy();
  });

  it('steps the glyph down a size as the Japanese form gets longer', () => {
    render(
      <>
        <ContentListRow
          rowType="kanji"
          glyph="水"
          title="water"
          onPress={jest.fn()}
          accessibilityLabel="Kanji: 水, water"
        />
        <ContentListRow
          rowType="vocabulary"
          glyph="はじめまして"
          title="nice to meet you"
          onPress={jest.fn()}
          accessibilityLabel="Vocabulary: はじめまして, nice to meet you"
        />
      </>,
    );

    expect(screen.getByText('水').props.className).toContain('text-title');
    expect(screen.getByText('はじめまして').props.className).toContain('text-body');
  });

  it('gives a passage its slate title, both summary lines and its own trailing pill', () => {
    render(
      <ContentListRow
        rowType="passage"
        title="自己紹介"
        caption="イギリスから来た大学生アンナの自己紹介。"
        captionSecondary="Anna introduces herself"
        trailingLabel="9 to go"
        trailingClassName="bg-content-grammar-soft"
        trailingTextClassName="text-content-grammar-deep"
        trailingTestID="row-lock"
        onPress={jest.fn()}
        accessibilityLabel="Passage: 自己紹介"
        testID="row"
      />,
    );

    expect(screen.getByTestId('row-edge').props.className).toContain('bg-content-passage');
    expect(screen.getByText('自己紹介').props.className).toContain('text-content-passage-deep');
    expect(screen.getByText('イギリスから来た大学生アンナの自己紹介。')).toBeTruthy();
    expect(screen.getByText('Anna introduces herself')).toBeTruthy();
    expect(screen.getByTestId('row-lock')).toHaveTextContent('9 to go');
    expect(screen.queryByText('PASSAGE')).toBeNull();
  });
});
