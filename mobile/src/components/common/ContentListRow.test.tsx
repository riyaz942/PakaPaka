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

  it('shows the type badge and the stage dot for curriculum items', () => {
    render(
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

    expect(screen.getByText('RADICAL')).toBeTruthy();
    expect(screen.getByLabelText('SRS stage: Guru')).toBeTruthy();
  });

  it('gives a passage its slate title and its own trailing pill instead of a type badge', () => {
    render(
      <ContentListRow
        rowType="passage"
        title="自己紹介"
        caption="Anna introduces herself"
        trailingLabel="9 to go"
        onPress={jest.fn()}
        accessibilityLabel="Passage: 自己紹介"
        testID="row"
      />,
    );

    expect(screen.getByTestId('row-edge').props.className).toContain('bg-content-passage');
    expect(screen.getByText('自己紹介').props.className).toContain('text-content-passage-deep');
    expect(screen.getByText('9 to go')).toBeTruthy();
    expect(screen.queryByText('PASSAGE')).toBeNull();
  });
});
