import { fireEvent, render, screen } from '@testing-library/react-native';

import type { GrammarSentenceCard, ReviewItem } from '@/core/srs/srs.types';

import { ReviewCard } from './ReviewCard';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'shown',
    knownKanji: new Set<string>(),
    modeForItem: () => 'shown',
    setOverride: jest.fn(),
  }),
}));

jest.mock('@/data/hooks/useDatabase', () => {
  const databases = { userDb: { getFirstSync: jest.fn(() => null) }, curriculumDb: {} };
  return { useDatabase: () => databases };
});

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: false }),
}));

function makeItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    itemId: 'test-1',
    itemType: 'kanji',
    primaryForm: '食',
    displayMeaning: 'eat, food',
    meanings: ['eat', 'food'],
    promptType: 'reading',
    answerKey: {
      acceptedMeanings: ['eat', 'food'],
      acceptedReadings: ['たべる'],
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

describe('ReviewCard — prompting state', () => {
  it('shows primary form large for kanji', () => {
    render(<ReviewCard item={makeItem()} state="prompting" />);
    expect(screen.getByText('食')).toBeTruthy();
  });

  it('shows "Reading — on\'yomi" mode label for a kanji reading prompt (FR81)', () => {
    render(<ReviewCard item={makeItem({ promptType: 'reading' })} state="prompting" />);
    expect(screen.getByText("Reading — on'yomi")).toBeTruthy();
  });

  it('shows bare "Reading" mode label for a vocabulary reading prompt', () => {
    render(
      <ReviewCard
        item={makeItem({ itemType: 'vocabulary', primaryForm: '食べる', promptType: 'reading' })}
        state="prompting"
      />,
    );
    expect(screen.getByText('Reading')).toBeTruthy();
  });

  it('shows "Meaning" mode label for meaning prompt', () => {
    render(<ReviewCard item={makeItem({ promptType: 'meaning' })} state="prompting" />);
    expect(screen.getByText('Meaning')).toBeTruthy();
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

  it('shows the on\'yomi nudge for wrong_reading_type without revealing the answer', () => {
    render(<ReviewCard item={makeItem({ promptType: 'reading' })} state="wrong_reading_type" />);
    expect(screen.getByText("We're looking for the on'yomi reading.")).toBeTruthy();
    // Prompt stays visible; the accepted reading is never revealed.
    expect(screen.getByText('食')).toBeTruthy();
    expect(screen.queryByText('たべる')).toBeNull();
  });

  it('keeps the prompt on screen while evaluating (no blank frame — Plan 12.5)', () => {
    render(<ReviewCard item={makeItem()} state="evaluating" />);
    expect(screen.getByText('食')).toBeTruthy();
    expect(screen.getByText("Reading — on'yomi")).toBeTruthy();
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

describe('ReviewCard — result states', () => {
  it('shows correct state with icon and the shared trimmed panel, meaning only (FR85)', () => {
    render(<ReviewCard item={makeItem({ promptType: 'meaning' })} state="correct" />);
    expect(screen.getByText('Correct')).toBeTruthy();
    // Shared AnswerReveal answers only the asked prompt — meaning here, not reading.
    expect(screen.getByText('eat, food')).toBeTruthy();
    expect(screen.queryByText('たべる')).toBeNull();
    expect(screen.getByLabelText('See full details')).toBeTruthy();
  });

  it('announces the accepted reading (not the meaning mislabeled) on a correct reading prompt', () => {
    render(<ReviewCard item={makeItem({ promptType: 'reading' })} state="correct" />);
    expect(screen.getByLabelText('Correct, reading: たべる')).toBeTruthy();
    expect(screen.getByText('たべる')).toBeTruthy();
    expect(screen.queryByText('eat, food')).toBeNull();
  });

  it('falls back to meaning announcement when a reading prompt has no accepted reading', () => {
    render(
      <ReviewCard
        item={makeItem({
          promptType: 'reading',
          answerKey: { acceptedMeanings: ['eat', 'food'], acceptedReadings: [] },
        })}
        state="correct"
      />,
    );
    expect(screen.getByLabelText('Correct, meaning: eat, food')).toBeTruthy();
    expect(screen.getByText('eat, food')).toBeTruthy();
  });

  it('shows incorrect state with icon and correct answer', () => {
    render(
      <ReviewCard
        item={makeItem()}
        state="incorrect"
        displayAnswer="たべる"
      />,
    );
    expect(screen.getByText('Incorrect')).toBeTruthy();
    expect(screen.getByText('Correct answer: たべる')).toBeTruthy();
  });

  it('shows typo state with warning icon and text', () => {
    render(<ReviewCard item={makeItem()} state="typo" />);
    expect(screen.getByText('~ Close! Try again.')).toBeTruthy();
  });

  it('shows a reading nudge for wrong_script on a reading prompt without revealing the answer', () => {
    render(<ReviewCard item={makeItem({ promptType: 'reading' })} state="wrong_script" />);
    expect(
      screen.getByText("We're looking for the reading in kana or romaji."),
    ).toBeTruthy();
    expect(screen.queryByText(/たべる/)).toBeNull();
    expect(screen.queryByText(/eat/)).toBeNull();
  });

  it('shows a meaning nudge for wrong_script on a meaning prompt', () => {
    render(<ReviewCard item={makeItem({ promptType: 'meaning' })} state="wrong_script" />);
    expect(screen.getByText("We're looking for the meaning in English.")).toBeTruthy();
  });

  it('shows the trimmed shared panel on incorrect: readings only for a reading prompt, no mnemonic/examples (FR85)', () => {
    render(
      <ReviewCard
        item={makeItem({ mnemonic: 'A roof over a fire cooking food.' })}
        state="incorrect"
        displayAnswer="たべる"
        revealDetail={{
          item: {
            id: 'test-1',
            slug: 'taberu',
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
        }}
      />,
    );
    expect(screen.queryByText('eat, food')).toBeNull();
    expect(screen.getByText("On'yomi: しょく")).toBeTruthy();
    expect(screen.getByText("Kun'yomi: た")).toBeTruthy();
    // Depth moved to the details route (Story 1.2): no inline mnemonic/examples.
    expect(screen.queryByText('A roof over a fire cooking food.')).toBeNull();
    expect(screen.queryByText('食べます')).toBeNull();
    expect(screen.getByLabelText('See full details')).toBeTruthy();
  });

  it('threads the answer collision line through both reveal paths (FR86)', () => {
    const collision = { itemId: 'other-9', primaryForm: '飲' };
    const { rerender } = render(
      <ReviewCard
        item={makeItem()}
        state="incorrect"
        displayAnswer="たべる"
        answerCollision={collision}
      />,
    );
    expect(screen.getByText('Your answer belongs to a different item: 飲.')).toBeTruthy();

    rerender(<ReviewCard item={makeItem()} state="correct" answerCollision={collision} />);
    expect(screen.getByText('Your answer belongs to a different item: 飲.')).toBeTruthy();
  });

  it('offers to accept the rejected answer as a user synonym on incorrect', () => {
    render(
      <ReviewCard
        item={makeItem({ promptType: 'meaning' })}
        state="incorrect"
        displayAnswer="eat"
        rejectedAnswer="meal"
        onAddSynonym={jest.fn()}
      />,
    );
    expect(screen.getByText('Accept "meal" as my answer')).toBeTruthy();
  });

  it('does not offer the synonym affordance without a rejected answer (Don\'t know)', () => {
    render(
      <ReviewCard
        item={makeItem({ promptType: 'meaning' })}
        state="incorrect"
        displayAnswer="eat"
        rejectedAnswer=""
        onAddSynonym={jest.fn()}
      />,
    );
    expect(screen.queryByText(/as my answer/)).toBeNull();
  });

  it('shows an advancing stage transition with upward affordance on correct', () => {
    render(
      <ReviewCard
        item={makeItem({ promptType: 'meaning' })}
        state="correct"
        stageTransition={{ from: 'apprentice', to: 'guru' }}
      />,
    );
    expect(screen.getByText('Apprentice → Guru ↑')).toBeTruthy();
    expect(
      screen.getByLabelText('SRS stage advanced from Apprentice to Guru'),
    ).toBeTruthy();
  });

  it('shows a dropped stage transition without upward affordance on incorrect', () => {
    render(
      <ReviewCard
        item={makeItem()}
        state="incorrect"
        displayAnswer="たべる"
        stageTransition={{ from: 'guru', to: 'apprentice' }}
      />,
    );
    expect(screen.getByText('Guru → Apprentice')).toBeTruthy();
    expect(
      screen.getByLabelText('SRS stage moved from Guru to Apprentice'),
    ).toBeTruthy();
  });

  it('shows no transition chrome when the stage did not change', () => {
    render(
      <ReviewCard item={makeItem({ promptType: 'meaning' })} state="correct" stageTransition={null} />,
    );
    expect(screen.queryByText(/→/)).toBeNull();
  });

  it('result regions have accessible labels', () => {
    const { rerender } = render(<ReviewCard item={makeItem({ promptType: 'meaning' })} state="correct" />);
    let result = screen.getByLabelText('Correct, meaning: eat, food');
    expect(result.props.accessible).toBe(true);

    rerender(
      <ReviewCard item={makeItem()} state="incorrect" displayAnswer="たべる" />,
    );
    result = screen.getByLabelText('Incorrect, correct answer is たべる');
    expect(result.props.accessible).toBe(true);

    rerender(<ReviewCard item={makeItem()} state="typo" />);
    result = screen.getByLabelText('Close, try again');
    expect(result.props.accessible).toBe(true);
  });
});

describe('ReviewCard — prompt stays visible through feedback (Plan 12.3/12.4)', () => {
  const grammar = makeItem({
    itemType: 'grammar',
    promptType: 'production',
    primaryForm: 'は',
    displayMeaning: 'topic marker',
    answerKey: {
      acceptedMeanings: ['topic marker'],
      acceptedReadings: [],
      grammar: { structure: 'Noun + は + comment', conjugationRules: {}, acceptedForms: ['は'] },
    },
  });

  it('keeps the prompt and mode label after a correct answer', () => {
    render(<ReviewCard item={makeItem({ promptType: 'reading' })} state="correct" />);
    expect(screen.getByText('食')).toBeTruthy();
    expect(screen.getByText("Reading — on'yomi")).toBeTruthy();
    expect(screen.getByText('Correct')).toBeTruthy();
  });

  it('keeps the prompt, mode label, and stage indicator on a typo nudge', () => {
    render(<ReviewCard item={makeItem()} state="typo" />);
    expect(screen.getByText('~ Close! Try again.')).toBeTruthy();
    expect(screen.getByText('食')).toBeTruthy();
    expect(screen.getByText("Reading — on'yomi")).toBeTruthy();
    expect(screen.getByLabelText('SRS stage: Apprentice')).toBeTruthy();
  });

  it('keeps the mode label and stage indicator on a wrong-script nudge', () => {
    render(<ReviewCard item={makeItem({ promptType: 'meaning' })} state="wrong_script" />);
    expect(screen.getByText("We're looking for the meaning in English.")).toBeTruthy();
    expect(screen.getByText('食')).toBeTruthy();
    expect(screen.getByText('Meaning')).toBeTruthy();
    expect(screen.getByLabelText('SRS stage: Apprentice')).toBeTruthy();
  });

  it('shows the pattern and the variant form together in the hero card', () => {
    render(
      <ReviewCard
        item={{ ...grammar, primaryForm: 'もの' }}
        state="incorrect"
        displayAnswer="もん"
      />,
    );
    expect(screen.getByText('もの / もん')).toBeTruthy();
    expect(screen.queryByText(/Correct answer:/)).toBeNull();
  });
});

describe('ReviewCard — hints and reinforcement', () => {
  const grammarLink = {
    relatedItemId: '20',
    primaryForm: '食べる',
    meaning: 'to eat',
    relationshipType: 'reinforces' as const,
    srsStageLabel: 'guru' as const,
    recencyPhrase: 'you learned this yesterday',
    displayText: '食べる — you learned this yesterday',
  };

  it('does not show Hint for non-grammar prompting state', () => {
    render(<ReviewCard item={makeItem()} state="prompting" />);
    expect(screen.queryByLabelText('Hint')).toBeNull();
  });

  it('shows reinforcement on correct state when link present', () => {
    render(
      <ReviewCard
        item={makeItem({ reinforcementLink: grammarLink })}
        state="correct"
      />,
    );
    expect(screen.getByText('食べる — you learned this yesterday')).toBeTruthy();
  });

  it('shows no reinforcement block when link absent on correct', () => {
    render(<ReviewCard item={makeItem()} state="correct" />);
    expect(screen.queryByText(/you learned this/)).toBeNull();
  });

  it('never shows reinforcement on incorrect or typo', () => {
    const item = makeItem({ reinforcementLink: grammarLink });
    render(<ReviewCard item={item} state="incorrect" displayAnswer="eat" />);
    expect(screen.queryByText('食べる — you learned this yesterday')).toBeNull();

    render(<ReviewCard item={item} state="typo" />);
    expect(screen.queryByText('食べる — you learned this yesterday')).toBeNull();
  });
});

describe('ReviewCard — two-card kanji affordance (FR81)', () => {
  it('offers an explanation beside the kicker on a two-card kanji', () => {
    render(<ReviewCard item={makeItem({ isTwoCardItem: true })} state="prompting" />);

    const info = screen.getByTestId('guidance-info-two-card-kanji');
    expect(info.props.accessibilityLabel).toBe('Explain: Why kanji ask twice');

    fireEvent.press(info);
    expect(screen.getByText('Why kanji ask twice')).toBeTruthy();
  });

  it('omits it for an item that is not part of a pair', () => {
    render(<ReviewCard item={makeItem({ isTwoCardItem: false })} state="prompting" />);

    expect(screen.queryByTestId('guidance-info-two-card-kanji')).toBeNull();
  });

  it('offers the stage explanation from the stage indicator', () => {
    render(<ReviewCard item={makeItem()} state="prompting" />);

    fireEvent.press(screen.getByTestId('guidance-info-spaced-repetition'));
    expect(screen.getByText('Why items come back')).toBeTruthy();
  });
});

describe('ReviewCard — reading-locked vocabulary (v2 rules 1/3/5)', () => {
  function makeLockedWord(overrides: Partial<ReviewItem> = {}): ReviewItem {
    return makeItem({
      itemType: 'vocabulary',
      primaryForm: '写真',
      furigana: '写[しゃ]真[しん]',
      promptType: 'meaning',
      displayMeaning: 'photograph',
      readingLocked: true,
      readingLockedBy: ['写', '真'],
      ...overrides,
    });
  }

  it('annotates the meaning prompt so an untaught word is still readable', () => {
    render(<ReviewCard item={makeLockedWord()} state="prompting" />);

    expect(screen.getByText('写')).toBeTruthy();
    expect(screen.getByText('しゃ')).toBeTruthy();
    expect(screen.getByText('真')).toBeTruthy();
    expect(screen.getByText('しん')).toBeTruthy();
  });

  it('names the kanji the word is waiting on', () => {
    render(<ReviewCard item={makeLockedWord()} state="prompting" />);

    expect(screen.getByTestId('reading-locked-note').props.children).toContain('写 and 真');
  });

  it('leaves an unlocked word bare — its reading card must not be given away', () => {
    render(
      <ReviewCard
        item={makeLockedWord({ readingLocked: false, readingLockedBy: undefined })}
        state="prompting"
      />,
    );

    expect(screen.getByTestId('review-prompt-glyph').props.children).toBe('写真');
    expect(screen.queryByText('しゃ')).toBeNull();
    expect(screen.queryByTestId('reading-locked-note')).toBeNull();
  });
});

const SENTENCE: GrammarSentenceCard = {
  sentenceKey: '寒いから、コートを着ます。',
  japanese: '寒いから、コートを着ます。',
  furigana: '寒[さむ]いから、コートを着[き]ます。',
  english: "Because it's cold, I'll wear a coat.",
  spans: [
    { vocabularyItemId: '20', startOffset: 0, endOffset: 2, inflection: null },
    { vocabularyItemId: '21', startOffset: 5, endOffset: 8, inflection: null },
  ],
  grammarSpan: { start: 2, end: 4 },
  register: 'polite',
  vocabulary: [
    { itemId: '20', primaryForm: '寒い', furigana: '寒[さむ]い', started: true },
    { itemId: '21', primaryForm: 'コート', furigana: null, started: false },
  ],
  answers: ['寒[さむ]いから、コートを着[き]ます。'],
  otherGrammarAnswers: [],
  userAnswers: [],
  diagnosisKey: null,
};

describe('ReviewCard — grammar pair', () => {
  const grammar = (promptType: 'meaning' | 'production') =>
    makeItem({
      itemType: 'grammar', primaryForm: 'から', promptType, isTwoCardItem: true,
      grammarRead: SENTENCE, grammarBuild: SENTENCE,
    });

  it('labels the Read and Build cards', () => {
    render(<ReviewCard item={grammar('meaning')} state="prompting" />);
    expect(screen.getByText('Grammar · Read')).toBeTruthy();
    render(<ReviewCard item={grammar('production')} state="prompting" />);
    expect(screen.getByText('Grammar · Build')).toBeTruthy();
  });

  it('shows the other-grammar nudge', () => {
    render(<ReviewCard item={grammar('production')} state="other_grammar" />);
    expect(screen.getByText('That works, but it uses a different grammar point. Try again.')).toBeTruthy();
  });

  it('offers "My answer is correct too" on a wrong Build answer', () => {
    const onSave = jest.fn();
    render(
      <ReviewCard
        item={grammar('production')}
        state="incorrect"
        displayAnswer={SENTENCE.japanese}
        rejectedAnswer="さむいからこーと"
        onSaveGrammarAnswer={onSave}
      />,
    );
    fireEvent.press(screen.getByText('My answer is correct too'));
    expect(onSave).toHaveBeenCalled();
  });

  it('a wrong Build answer keeps the hero to the grammar form; the sentence shows in the card', () => {
    render(
      <ReviewCard item={grammar('production')} state="incorrect" displayAnswer={SENTENCE.japanese} />,
    );
    expect(screen.getAllByText('から').length).toBeGreaterThan(0);
    expect(screen.queryByText(`から / ${SENTENCE.japanese}`)).toBeNull();
    expect(screen.getByTestId(`grammar-build-answer-${SENTENCE.sentenceKey}-linked`)).toBeTruthy();
  });
});
