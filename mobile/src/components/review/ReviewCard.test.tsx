import { render, screen } from '@testing-library/react-native';

import type { ReviewItem } from '@/core/srs/srs.types';

import { ReviewCard } from './ReviewCard';

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    itemId: 'test-1',
    itemType: 'kanji',
    primaryForm: '食',
    meanings: ['eat', 'food'],
    promptType: 'reading',
    srsState: {
      itemId: 'test-1',
      stability: 1,
      difficulty: 5,
      dueDate: new Date().toISOString(),
      fsrsState: 'new',
      reps: 0,
      lapses: 0,
      isBurned: false,
      srsStageLabel: 'apprentice',
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('ReviewCard — prompting state', () => {
  it('shows primary form large for kanji', () => {
    render(<ReviewCard item={makeItem()} state="prompting" />);
    expect(screen.getByText('食')).toBeTruthy();
  });

  it('shows "Reading" mode label for reading prompt', () => {
    render(<ReviewCard item={makeItem({ promptType: 'reading' })} state="prompting" />);
    expect(screen.getByText('Reading')).toBeTruthy();
  });

  it('shows "Meaning" mode label for meaning prompt', () => {
    render(<ReviewCard item={makeItem({ promptType: 'meaning' })} state="prompting" />);
    expect(screen.getByText('Meaning')).toBeTruthy();
  });

  it('shows "Production" mode label for grammar production', () => {
    render(
      <ReviewCard item={makeItem({ itemType: 'grammar', promptType: 'production' })} state="prompting" />,
    );
    expect(screen.getByText('Production')).toBeTruthy();
  });

  it('hides meanings during reading prompt', () => {
    render(<ReviewCard item={makeItem({ promptType: 'reading' })} state="prompting" />);
    expect(screen.queryByText('eat, food')).toBeNull();
  });

  it('hides meanings during meaning prompt', () => {
    render(<ReviewCard item={makeItem({ promptType: 'meaning' })} state="prompting" />);
    expect(screen.queryByText('eat, food')).toBeNull();
  });

  it('shows SRS stage indicator', () => {
    render(<ReviewCard item={makeItem()} state="prompting" />);
    expect(screen.getByLabelText('SRS stage: Apprentice')).toBeTruthy();
  });

  it('renders null for evaluating state (placeholder for 5.3)', () => {
    const { toJSON } = render(
      <ReviewCard item={makeItem()} state="evaluating" />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows primary form for radical', () => {
    render(
      <ReviewCard item={makeItem({ itemType: 'radical', promptType: 'meaning' })} state="prompting" />,
    );
    expect(screen.getByText('食')).toBeTruthy();
  });

  it('shows primary form for vocabulary', () => {
    render(
      <ReviewCard item={makeItem({ itemType: 'vocabulary', primaryForm: '食べる', promptType: 'reading' })} state="prompting" />,
    );
    expect(screen.getByText('食べる')).toBeTruthy();
  });

  it('shows primary form for grammar as sentence', () => {
    render(
      <ReviewCard
        item={makeItem({ itemType: 'grammar', primaryForm: '私は＿します', promptType: 'production' })}
        state="prompting"
      />,
    );
    expect(screen.getByText('私は＿します')).toBeTruthy();
  });
});
