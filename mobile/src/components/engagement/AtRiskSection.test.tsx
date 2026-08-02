import { fireEvent, render, screen } from '@testing-library/react-native';

import { AtRiskSection } from './AtRiskSection';

const ITEMS = [
  { itemId: '1', primaryForm: '食べる', meaning: 'to eat', itemType: 'vocabulary' as const },
  { itemId: '2', primaryForm: '飲む', meaning: 'to drink', itemType: 'vocabulary' as const },
];

describe('AtRiskSection', () => {
  it('renders invitation copy, top items, and the +N more overflow', () => {
    render(
      <AtRiskSection
        totalCount={12}
        topItems={ITEMS}
        allItems={ITEMS}
        onStartRevision={jest.fn()}
      />,
    );

    expect(
      screen.getByText('12 items are slipping — this session will target them first.'),
    ).toBeTruthy();
    expect(screen.getByText('食べる')).toBeTruthy();
    expect(screen.getByText('+10 more')).toBeTruthy();
    // Invitation framing only — never failure language.
    expect(screen.queryByText(/fail/i)).toBeNull();
  });

  it('fires the small revision CTA', () => {
    const onStartRevision = jest.fn();
    render(
      <AtRiskSection
        totalCount={2}
        topItems={ITEMS}
        allItems={ITEMS}
        onStartRevision={onStartRevision}
      />,
    );

    fireEvent.press(screen.getByTestId('at-risk-start-revision'));
    expect(onStartRevision).toHaveBeenCalledTimes(1);
  });

  it('opens the full list on tap', () => {
    render(
      <AtRiskSection
        totalCount={2}
        topItems={ITEMS}
        allItems={ITEMS}
        onStartRevision={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('at-risk-open-full-list'));
    expect(screen.getByTestId('at-risk-full-list')).toBeTruthy();
  });
});
