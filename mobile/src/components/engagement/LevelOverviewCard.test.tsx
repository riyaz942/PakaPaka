import { fireEvent, render, screen } from '@testing-library/react-native';

import { LevelOverviewCard } from './LevelOverviewCard';

const FULL_CONTENT_PER_CATEGORY = {
  radical: { started: 20, total: 25 },
  kanji: { started: 10, total: 32 },
  vocabulary: { started: 15, total: 41 },
  grammar: { started: 4, total: 16 },
  passage: { started: 1, total: 3 },
};

const SKELETON_PER_CATEGORY = {
  radical: { started: 2, total: 10 },
  kanji: { started: 1, total: 12 },
  vocabulary: { started: 0, total: 20 },
  grammar: { started: 0, total: 0 },
  passage: { started: 0, total: 0 },
};

describe('LevelOverviewCard', () => {
  it('renders all five category rows with started/total counts', () => {
    render(
      <LevelOverviewCard
        level="N5"
        perCategory={FULL_CONTENT_PER_CATEGORY}
        overallPercent={42}
        isActive={false}
        hasFullContent
        onSetActive={() => {}}
      />,
    );

    expect(screen.getByText('Radicals')).toBeTruthy();
    expect(screen.getByText('20/25')).toBeTruthy();
    expect(screen.getByText('10/32')).toBeTruthy();
    expect(screen.getByText('15/41')).toBeTruthy();
    expect(screen.getByText('4/16')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('shows the active-level indicator and no set-active button when isActive', () => {
    render(
      <LevelOverviewCard
        level="N4"
        perCategory={FULL_CONTENT_PER_CATEGORY}
        overallPercent={42}
        isActive
        hasFullContent
        onSetActive={() => {}}
        testID="levels-card-N4"
      />,
    );

    expect(screen.getByText('Active level')).toBeTruthy();
    expect(screen.queryByTestId('levels-card-N4-set-active')).toBeNull();
  });

  it('fires onSetActive when the set-active button is pressed on a non-active full-content level', () => {
    const onSetActive = jest.fn();
    render(
      <LevelOverviewCard
        level="N5"
        perCategory={FULL_CONTENT_PER_CATEGORY}
        overallPercent={42}
        isActive={false}
        hasFullContent
        onSetActive={onSetActive}
        testID="levels-card-N5"
      />,
    );

    fireEvent.press(screen.getByTestId('levels-card-N5-set-active'));
    expect(onSetActive).toHaveBeenCalledWith('N5');
  });

  it('shows a limited-content caption and no button for a non-active skeleton level', () => {
    render(
      <LevelOverviewCard
        level="N3"
        perCategory={SKELETON_PER_CATEGORY}
        overallPercent={10}
        isActive={false}
        hasFullContent={false}
        onSetActive={() => {}}
        testID="levels-card-N3"
      />,
    );

    expect(screen.getByText('Limited content')).toBeTruthy();
    expect(screen.getAllByText('Not yet available')).toHaveLength(2);
    expect(screen.queryByTestId('levels-card-N3-set-active')).toBeNull();
    expect(
      screen.getByText(/Kanji and vocabulary only.*grammar and passages aren't available for N3 yet\./),
    ).toBeTruthy();
  });

  it('exposes a progressbar with the composed accessibility value', () => {
    render(
      <LevelOverviewCard
        level="N5"
        perCategory={FULL_CONTENT_PER_CATEGORY}
        overallPercent={42}
        isActive={false}
        hasFullContent
        onSetActive={() => {}}
      />,
    );

    const bar = screen.getByLabelText(/N5 progress 42 percent\./);
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 42 });
  });
});
