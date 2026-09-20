import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ReviewItem } from '@/core/srs/srs.types';
import type { ReviewRevealDetail } from '@/data/hooks/useReviewRevealDetails';

import { AnswerReveal } from './AnswerReveal';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), back: jest.fn() },
}));

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    itemId: 'test-1',
    itemType: 'kanji',
    primaryForm: '食',
    displayMeaning: 'eat, food',
    meanings: ['eat', 'food', 'meal'],
    promptType: 'reading',
    mnemonic: 'A roof over a fire cooking food.',
    answerKey: {
      acceptedMeanings: ['eat', 'food'],
      acceptedReadings: ['しょく'],
    },
    relatedItems: [],
    reinforcementLink: null,
    srsState: {
      itemId: 'test-1',
      stability: 1,
      difficulty: 5,
      dueDate: new Date().toISOString(),
      fsrsState: 'new',
      reps: 0,
      lapses: 0,
      learningSteps: 0,
      isBurned: false,
      srsStageLabel: 'apprentice',
      lastReviewedAt: null,
      updatedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

function makeDetail(): ReviewRevealDetail {
  return {
    item: {
      id: 'test-1',
      slug: 'eat',
      itemType: 'kanji',
      jlptLevel: 'N5',
      primaryForm: '食',
      furigana: null,
      meaning: 'eat, food',
      wordType: null,
      readingComposition: null,
      mnemonicText: 'A roof over a fire cooking food.',
      meaningMnemonic: null,
      readingMnemonic: null,
      description: null,
      visualMnemonicUrl: null,
    },
    kanjiReadings: [
      { id: 'r1', readingType: 'onyomi', reading: 'しょく', sortOrder: 0 },
      { id: 'r2', readingType: 'kunyomi', reading: 'た', sortOrder: 1 },
    ],
    exampleSentences: [
      { id: 's1', japanese: '食べます', furigana: null, english: 'I eat.', sortOrder: 0, vocabularyLinks: [], spans: [] },
    ],
  };
}

describe('AnswerReveal — shared trimmed panel (FR85, UX-DR8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows only grouped kanji readings for a reading prompt (no meaning)', () => {
    render(<AnswerReveal item={makeItem({ promptType: 'reading' })} detail={makeDetail()} />);
    expect(screen.queryByText('eat, food')).toBeNull();
    expect(screen.getByText("On'yomi: しょく")).toBeTruthy();
    expect(screen.getByText("Kun'yomi: た")).toBeTruthy();
  });

  it('shows only the meaning for a meaning prompt (no readings)', () => {
    render(<AnswerReveal item={makeItem({ promptType: 'meaning' })} detail={makeDetail()} />);
    expect(screen.getByText('eat, food')).toBeTruthy();
    expect(screen.queryByText(/On'yomi/)).toBeNull();
    expect(screen.queryByText(/Kun'yomi/)).toBeNull();
    expect(screen.queryByText('Readings')).toBeNull();
  });

  it('never shows mnemonic or example sentences (trimmed — depth via details route)', () => {
    render(<AnswerReveal item={makeItem({ promptType: 'meaning' })} detail={makeDetail()} />);
    expect(screen.queryByText('A roof over a fire cooking food.')).toBeNull();
    expect(screen.queryByText('食べます')).toBeNull();
    expect(screen.queryByText(/Mnemonic/i)).toBeNull();
    expect(screen.queryByText(/Examples/i)).toBeNull();
  });

  it('lists non-derived alternate meanings', () => {
    render(
      <AnswerReveal
        item={makeItem({
          promptType: 'meaning',
          displayMeaning: 'eat / food',
          meanings: ['eat', 'food', 'meal'],
        })}
        detail={null}
      />,
    );
    expect(screen.getByText('Also accepted: meal')).toBeTruthy();
  });

  it('falls back to answer-key readings when no detail is prefetched', () => {
    render(<AnswerReveal item={makeItem({ promptType: 'reading' })} detail={null} />);
    expect(screen.getByText('しょく')).toBeTruthy();
  });

  it('skips the tautological reading for kana-only vocabulary', () => {
    render(
      <AnswerReveal
        item={makeItem({
          itemType: 'vocabulary',
          promptType: 'reading',
          primaryForm: 'ここ',
          displayMeaning: 'here',
          meanings: ['here'],
          answerKey: { acceptedMeanings: ['here'], acceptedReadings: ['ここ'] },
        })}
        detail={null}
      />,
    );
    expect(screen.queryByText('Reading')).toBeNull();
  });

  it('navigates to the details route under review/ (session-safe)', () => {
    render(<AnswerReveal item={makeItem()} detail={null} />);
    fireEvent.press(screen.getByLabelText('See full details'));
    expect(mockPush).toHaveBeenCalledWith('/review/item/test-1');
  });

  it('shows the collision line and links Compare with both items preselected (FR86)', () => {
    render(
      <AnswerReveal
        item={makeItem()}
        detail={null}
        collision={{ itemId: 'other-9', primaryForm: '飲' }}
      />,
    );
    expect(screen.getByText('Your answer belongs to a different item: 飲.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Compare with 飲'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/review/compare',
      params: { left: 'test-1', right: 'other-9' },
    });
  });

  it('shows no collision chrome when there is no collision', () => {
    render(<AnswerReveal item={makeItem()} detail={null} />);
    expect(screen.queryByText(/different item/)).toBeNull();
    expect(screen.queryByText('Compare these items')).toBeNull();
  });
});
