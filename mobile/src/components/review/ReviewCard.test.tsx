import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ReviewItem } from '@/core/srs/srs.types';

import { ReviewCard } from './ReviewCard';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({ mode: 'shown', knownKanji: new Set<string>() }),
}));

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

  it('shows "Grammar" mode label for grammar production (never "Production" or "Reading")', () => {
    render(
      <ReviewCard item={makeItem({ itemType: 'grammar', promptType: 'production' })} state="prompting" />,
    );
    expect(screen.getByText('Grammar')).toBeTruthy();
    expect(screen.queryByText('Production')).toBeNull();
    expect(screen.queryByText('Reading')).toBeNull();
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

describe('ReviewCard — grammar cloze contract (Plan 07)', () => {
  const waTopic = (overrides: Partial<ReviewItem> = {}) =>
    makeItem({
      itemType: 'grammar',
      promptType: 'production',
      primaryForm: 'は',
      displayMeaning: 'topic marker',
      clozePrompt: '私＿＿＿学生です。',
      answerKey: {
        acceptedMeanings: ['topic marker'],
        acceptedReadings: [],
        grammar: { structure: 'Noun + は + comment', conjugationRules: {}, acceptedForms: ['は'] },
      },
      ...overrides,
    });

  it('prompts with the cloze sentence, never the bare particle', () => {
    render(<ReviewCard item={waTopic()} state="prompting" />);
    expect(screen.getByText('私＿＿＿学生です。')).toBeTruthy();
    expect(screen.queryByText('は')).toBeNull();
  });

  it('renders authored cloze furigana through FuriganaText (Plan 11.8)', () => {
    render(
      <ReviewCard
        item={waTopic({ clozePromptFurigana: '私[わたし]＿＿＿学[がく]生[せい]です。' })}
        state="prompting"
      />,
    );
    // Annotated runs expose the surface via accessibilityLabel.
    expect(screen.getByLabelText('私＿＿＿学生です。')).toBeTruthy();
    expect(screen.getByText('わたし')).toBeTruthy();
    expect(screen.queryByText('は')).toBeNull();
  });

  it('does not show English on the cloze prompt', () => {
    render(<ReviewCard item={waTopic()} state="prompting" />);
    expect(screen.queryByText(/topic marker/)).toBeNull();
    expect(screen.queryByText(/I am a student/)).toBeNull();
  });

  it('falls back to primaryForm when no cloze is available', () => {
    render(<ReviewCard item={waTopic({ clozePrompt: null })} state="prompting" />);
    expect(screen.getByText('は')).toBeTruthy();
  });

  it('shows the cloze sentence (not the bare form) on wrong_script', () => {
    render(<ReviewCard item={waTopic()} state="wrong_script" />);
    expect(screen.getByText('私＿＿＿学生です。')).toBeTruthy();
    expect(screen.queryByText('は')).toBeNull();
  });

  it('announces the grammar chunk as "answer" (not "reading") on correct', () => {
    render(<ReviewCard item={waTopic()} state="correct" />);
    // The graded chunk is announced via the result region; the visible reveal
    // is the shared trimmed panel (Story 1.2, FR85).
    expect(screen.getByLabelText('Correct, answer: は')).toBeTruthy();
    expect(screen.queryByText(/Reading:/)).toBeNull();
    expect(screen.getByText('topic marker')).toBeTruthy();
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
  const cloze = makeItem({
    itemType: 'grammar',
    promptType: 'production',
    primaryForm: 'は',
    displayMeaning: 'topic marker',
    clozePrompt: '私＿＿＿学生です。',
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

  it('fills the blank in the cloze sentence on a correct grammar answer', () => {
    render(<ReviewCard item={cloze} state="correct" />);
    expect(screen.getByText('私は学生です。')).toBeTruthy();
    expect(screen.queryByText('私＿＿＿学生です。')).toBeNull();
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

  it('shows the cloze sentence on a terminal incorrect grammar reveal', () => {
    render(<ReviewCard item={cloze} state="incorrect" displayAnswer="は" />);
    expect(screen.getByText('Incorrect')).toBeTruthy();
    expect(screen.getByText('私＿＿＿学生です。')).toBeTruthy();
    expect(screen.getByText('は')).toBeTruthy();
    expect(screen.queryByText(/Correct answer:/)).toBeNull();
  });

  it('shows the pattern and the variant form together in the hero card', () => {
    render(
      <ReviewCard
        item={{ ...cloze, primaryForm: 'もの', clozeAnswer: 'もん' }}
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

  it('shows Hint button for grammar prompting state', () => {
    render(
      <ReviewCard
        item={makeItem({
          itemType: 'grammar',
          promptType: 'production',
          answerKey: {
            acceptedMeanings: ['copula'],
            acceptedReadings: [],
            grammar: { structure: 'Noun + です', conjugationRules: {}, acceptedForms: ['です'] },
          },
        })}
        state="prompting"
      />,
    );
    expect(screen.getByLabelText('Hint')).toBeTruthy();
  });

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

describe('ReviewCard — stage-gated grammar hints (Plans 08/10)', () => {
  const grammarAtStage = (stage: 'guru' | 'enlightened') =>
    makeItem({
      itemType: 'grammar',
      promptType: 'production',
      primaryForm: 'は',
      displayMeaning: 'topic marker',
      clozePrompt: '私＿＿＿学生です。',
      clozeNudge: 'Marks the topic — what is being talked about.',
      clozeEnglish: 'I am a student.',
      answerKey: {
        acceptedMeanings: ['topic marker'],
        acceptedReadings: [],
        grammar: { structure: 'Noun + は + comment', conjugationRules: {}, acceptedForms: ['は'] },
      },
      srsState: {
        itemId: 'test-1',
        stability: 1,
        difficulty: 5,
        dueDate: new Date().toISOString(),
        fsrsState: 'review',
        reps: 8,
        lapses: 0,
        learningSteps: 0,
        isBurned: false,
        srsStageLabel: stage,
        lastReviewedAt: null,
        updatedAt: new Date().toISOString(),
      },
    });

  it('pre-Enlightened: nudge then English are revealable', () => {
    render(<ReviewCard item={grammarAtStage('guru')} state="prompting" />);
    fireEvent.press(screen.getByLabelText('Hint'));
    expect(screen.getByText('Marks the topic — what is being talked about.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Hint (1/2)'));
    expect(screen.getByText('I am a student.')).toBeTruthy();
  });

  it('Enlightened: English rung is absent; nudge remains', () => {
    render(<ReviewCard item={grammarAtStage('enlightened')} state="prompting" />);
    fireEvent.press(screen.getByLabelText('Hint'));
    expect(screen.getByText('Marks the topic — what is being talked about.')).toBeTruthy();
    // Hint ladder exhausted after the nudge — no second rung, no English anywhere.
    expect(screen.queryByLabelText(/Hint \(/)).toBeNull();
    expect(screen.queryByText('I am a student.')).toBeNull();
    expect(screen.queryByText(/topic marker/)).toBeNull();
  });

  it('drops the nudge fallback when it would just repeat the visible cloze prompt (no example-sentence match, structure fallback on both)', () => {
    // Mirrors an unauthored N4 item: clozePrompt has no example-sentence
    // match, so it falls back to the same blanked structure frame the nudge
    // fallback would also produce — showing it as a "hint" would repeat the
    // question verbatim.
    const item = makeItem({
      itemType: 'grammar',
      promptType: 'production',
      primaryForm: 'ようにする',
      // Empty so the English rung's displayMeaning fallback doesn't mask what
      // this test is isolating: the nudge-only fallback path.
      displayMeaning: '',
      clozePrompt: 'Dictionary form / ない form + ＿＿＿',
      clozeNudge: null,
      clozeEnglish: null,
      answerKey: {
        acceptedMeanings: ['to try to make it so'],
        acceptedReadings: [],
        grammar: {
          structure: 'Dictionary form / ない form + ようにする',
          conjugationRules: {},
          acceptedForms: ['ようにする', 'ようにしている'],
        },
      },
    });
    render(<ReviewCard item={item} state="prompting" />);
    expect(screen.queryByLabelText('Hint')).toBeNull();
    expect(screen.getAllByText('Dictionary form / ない form + ＿＿＿')).toHaveLength(1);
  });

  it('authored N4 variant: apprentice gets a real nudge about the sentence, not the prompt again', () => {
    // The same point as the test above, now that Plan 09 covers N4: the queue
    // supplies the authored variant's cloze, nudge and English instead of the
    // structure frame, so rung 1 says something the prompt does not.
    const item = makeItem({
      itemType: 'grammar',
      promptType: 'production',
      primaryForm: 'ようにする',
      displayMeaning: 'to try to make it so / make a habit of',
      clozePrompt: '毎朝、野菜を食べる＿＿＿。',
      clozeNudge: 'Is this describing one bite of vegetables, or something aimed at every single morning?',
      clozeEnglish: 'I make a point of eating vegetables every morning.',
      answerKey: {
        acceptedMeanings: ['to try to make it so'],
        acceptedReadings: [],
        grammar: {
          structure: 'Dictionary form / ない form + ようにする',
          conjugationRules: {},
          acceptedForms: ['ようにする', 'ようにしている'],
        },
      },
      srsState: {
        itemId: 'test-2',
        stability: 1,
        difficulty: 5,
        dueDate: new Date().toISOString(),
        fsrsState: 'learning',
        reps: 1,
        lapses: 0,
        learningSteps: 0,
        isBurned: false,
        srsStageLabel: 'apprentice',
        lastReviewedAt: null,
        updatedAt: new Date().toISOString(),
      },
    });

    render(<ReviewCard item={item} state="prompting" />);
    fireEvent.press(screen.getByLabelText('Hint'));
    const nudge = 'Is this describing one bite of vegetables, or something aimed at every single morning?';
    expect(screen.getByText(nudge)).toBeTruthy();
    // The bug: the "hint" repeating the question the learner is already reading.
    expect(nudge).not.toBe(item.clozePrompt);
    expect(screen.queryAllByText('毎朝、野菜を食べる＿＿＿。')).toHaveLength(1);
    // Apprentice is below the Enlightened gate, so the English rung is there too.
    fireEvent.press(screen.getByLabelText('Hint (1/2)'));
    expect(screen.getByText('I make a point of eating vegetables every morning.')).toBeTruthy();
  });
});

describe('ReviewCard — near-miss incomplete reveal (Plan 10)', () => {
  const waTopic = makeItem({
    itemType: 'grammar',
    promptType: 'production',
    primaryForm: 'は',
    displayMeaning: 'topic marker',
    clozePrompt: '私＿＿＿学生です。',
    answerKey: {
      acceptedMeanings: ['topic marker'],
      acceptedReadings: [],
      grammar: { structure: 'Noun + は + comment', conjugationRules: {}, acceptedForms: ['は'] },
    },
  });

  it('shows teaching copy, the chunk, and the completed sentence', () => {
    render(
      <ReviewCard item={waTopic} state="incorrect" displayAnswer="は" incompleteAnswer />,
    );
    expect(screen.getByText('Not quite')).toBeTruthy();
    expect(
      screen.getByText('You had the right idea — we need just the grammar piece:'),
    ).toBeTruthy();
    expect(screen.getByText('私は学生です。')).toBeTruthy();
  });

  it('renders the completed sentence with furigana when authored (Plan 11.8)', () => {
    render(
      <ReviewCard
        item={{
          ...waTopic,
          clozePromptFurigana: '私[わたし]＿＿＿学[がく]生[せい]です。',
        }}
        state="incorrect"
        displayAnswer="は"
        incompleteAnswer
      />,
    );
    expect(screen.getByLabelText('私は学生です。')).toBeTruthy();
    expect(screen.getByText('わたし')).toBeTruthy();
  });

  it('plain incorrect keeps the standard reveal', () => {
    render(<ReviewCard item={waTopic} state="incorrect" displayAnswer="は" />);
    expect(screen.getByText('Incorrect')).toBeTruthy();
    expect(screen.getByText('は')).toBeTruthy();
    expect(screen.queryByText(/right idea/)).toBeNull();
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
