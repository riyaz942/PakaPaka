import { blankFormInFurigana, buildGrammarCloze, CLOZE_BLANK } from './clozeBuilder';

describe('blankFormInFurigana', () => {
  it('blanks a particle outside reading brackets', () => {
    expect(blankFormInFurigana('私[わたし]は学[がく]生[せい]です。', 'は')).toBe(
      `私[わたし]${CLOZE_BLANK}学[がく]生[せい]です。`,
    );
  });

  it('does not match text inside reading brackets', () => {
    expect(blankFormInFurigana('食[は]', 'は')).toBeNull();
  });

  it('blanks only the first surface occurrence', () => {
    expect(blankFormInFurigana('猫[ねこ]は好[す]きですが、犬[いぬ]は苦[にが]手です。', 'は')).toBe(
      `猫[ねこ]${CLOZE_BLANK}好[す]きですが、犬[いぬ]は苦[にが]手です。`,
    );
  });

  it('consumes a trailing reading bracket on the last blanked character', () => {
    expect(blankFormInFurigana('水[みず]を飲[の]みます。', '水')).toBe(
      `${CLOZE_BLANK}を飲[の]みます。`,
    );
  });
});

describe('buildGrammarCloze', () => {
  it('derives a particle cloze from the first example sentence (wa-topic)', () => {
    const cloze = buildGrammarCloze({
      exampleSentences: [
        { japanese: '私は学生です。', furigana: '私[わたし]は学[がく]生[せい]です。' },
        { japanese: 'これは本です。' },
      ],
      acceptedForms: ['は'],
      structure: 'Noun + は + comment',
    });
    expect(cloze).toEqual({
      prompt: `私${CLOZE_BLANK}学生です。`,
      promptFurigana: `私[わたし]${CLOZE_BLANK}学[がく]生[せい]です。`,
      source: 'example',
    });
  });

  it('guard: the wa-topic prompting surface contains a blank and never equals "は"', () => {
    const cloze = buildGrammarCloze({
      exampleSentences: [{ japanese: '私は学生です。' }],
      acceptedForms: ['は'],
      structure: 'Noun + は + comment',
    });
    expect(cloze?.prompt).toContain(CLOZE_BLANK);
    expect(cloze?.prompt).not.toBe('は');
    expect(cloze?.promptFurigana).toBeNull();
  });

  it('blanks the longest matching form (てください over て)', () => {
    const cloze = buildGrammarCloze({
      exampleSentences: [{ japanese: 'ちょっと待ってください。' }],
      acceptedForms: ['て', 'てください', 'でください'],
      structure: 'Verb-て + ください',
    });
    expect(cloze).toEqual({
      prompt: `ちょっと待っ${CLOZE_BLANK}。`,
      promptFurigana: null,
      source: 'example',
    });
  });

  it('blanks only the first occurrence of the form', () => {
    const cloze = buildGrammarCloze({
      exampleSentences: [{ japanese: '猫は好きですが、犬は苦手です。' }],
      acceptedForms: ['は'],
    });
    expect(cloze?.prompt).toBe(`猫${CLOZE_BLANK}好きですが、犬は苦手です。`);
  });

  it('skips sentences without a matching form and uses a later one', () => {
    const cloze = buildGrammarCloze({
      exampleSentences: [{ japanese: '本です。' }, { japanese: '私はご飯を食べます。' }],
      acceptedForms: ['を'],
    });
    expect(cloze).toEqual({
      prompt: `私はご飯${CLOZE_BLANK}食べます。`,
      promptFurigana: null,
      source: 'example',
    });
  });

  it('falls back to a structure-frame cloze when there are no example sentences', () => {
    const cloze = buildGrammarCloze({
      exampleSentences: [],
      acceptedForms: ['は'],
      structure: 'Noun + は + comment',
    });
    expect(cloze).toEqual({
      prompt: `Noun + ${CLOZE_BLANK} + comment`,
      promptFurigana: null,
      source: 'structure',
    });
  });

  it('falls back to a substring blank when no structure token matches exactly', () => {
    const cloze = buildGrammarCloze({
      exampleSentences: [],
      acceptedForms: ['て', 'で'],
      structure: 'Verb → て form',
    });
    expect(cloze).toEqual({
      prompt: `Verb → ${CLOZE_BLANK} form`,
      promptFurigana: null,
      source: 'structure',
    });
  });

  it('returns the bare structure frame when the form does not occur in it', () => {
    const cloze = buildGrammarCloze({
      exampleSentences: [],
      acceptedForms: ['なきゃ'],
      structure: 'Verb-ない stem + なければならない',
    });
    expect(cloze).toEqual({
      prompt: 'Verb-ない stem + なければならない',
      promptFurigana: null,
      source: 'structure',
    });
  });

  it('never matches discontinuous 〜 template forms against sentences', () => {
    const cloze = buildGrammarCloze({
      exampleSentences: [{ japanese: 'まだ食べていません。' }],
      acceptedForms: ['まだ〜ていない', 'まだ〜ていません'],
      structure: 'まだ + Verb-て + いない',
    });
    // No literal match → structure fallback, not a fragment blank.
    expect(cloze?.source).toBe('structure');
    expect(cloze?.prompt).toContain('まだ');
    expect(cloze?.promptFurigana).toBeNull();
  });

  it('returns null when there is no sentence match and no structure', () => {
    expect(
      buildGrammarCloze({ exampleSentences: [], acceptedForms: ['は'], structure: null }),
    ).toBeNull();
    expect(buildGrammarCloze({ exampleSentences: [], acceptedForms: ['は'] })).toBeNull();
  });

  it('never returns a prompt equal to an accepted form', () => {
    expect(
      buildGrammarCloze({ exampleSentences: [], acceptedForms: ['は'], structure: 'は' }),
    ).toBeNull();
  });
});
