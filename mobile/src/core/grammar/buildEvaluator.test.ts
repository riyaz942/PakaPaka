import { evaluateGrammarBuild, matchesFuriganaAnswer, normalizeBuildText } from './buildEvaluator';

const MAIN = '寒[さむ]いから、コートを着[き]ます。';
const key = {
  answers: [MAIN, '寒[さむ]いですから、コートを着[き]ます。'],
  otherGrammarAnswers: ['寒[さむ]いので、コートを着[き]ます。'],
  userAnswers: [] as string[],
};

describe('normalizeBuildText', () => {
  it('folds katakana to hiragana and keeps the long-vowel mark', () => {
    expect(normalizeBuildText('コーヒー')).toBe('こーひー');
  });

  it('drops whitespace and sentence punctuation, full-width space included', () => {
    expect(normalizeBuildText(' 寒い、 から。！？!?,.　')).toBe('寒いから');
  });
});

describe('evaluateGrammarBuild', () => {
  it.each([
    ['all kana', 'さむいから、こーとをきます。'],
    ['kanji as written', '寒いから、コートを着ます。'],
    ['kanji and kana mixed per word', '寒いからこーとをきます'],
    ['katakana typed for hiragana', 'サムイカラコートヲキマス'],
    ['no punctuation, extra spaces', '寒い から コートを 着ます'],
    ['a valid alternate', '寒いですから、コートを着ます。'],
  ])('%s → correct', (_label, input) => {
    expect(evaluateGrammarBuild(input, key)).toBe('correct');
  });

  it('another kanji word is incorrect', () => {
    expect(evaluateGrammarBuild('暑いから、コートを着ます。', key)).toBe('incorrect');
  });

  it('a dropped word is incorrect', () => {
    expect(evaluateGrammarBuild('寒いから着ます', key)).toBe('incorrect');
  });

  it('a same-family grammar answer is other_grammar', () => {
    expect(evaluateGrammarBuild('さむいので、こーとをきます', key)).toBe('other_grammar');
  });

  it('a saved user answer matches by normalised text, kanji included', () => {
    const withUser = { ...key, userAnswers: [normalizeBuildText('寒いからコート着ます')] };
    expect(evaluateGrammarBuild('寒いから、コート着ます。', withUser)).toBe('correct');
  });

  it('empty or punctuation-only input is incorrect', () => {
    expect(evaluateGrammarBuild('  。', key)).toBe('incorrect');
  });
});

describe('matchesFuriganaAnswer', () => {
  const SENTENCE = '私[わたし]は学[がく]生[せい]です。';

  it('accepts the reading of each annotated run', () => {
    expect(matchesFuriganaAnswer(normalizeBuildText('わたしはがくせいです'), SENTENCE)).toBe(true);
  });

  it('accepts kanji and kana mixed inside one word (学せい)', () => {
    expect(matchesFuriganaAnswer(normalizeBuildText('私は学せいです'), SENTENCE)).toBe(true);
  });

  it('rejects a different word in the same slot (僕 for 私)', () => {
    expect(matchesFuriganaAnswer(normalizeBuildText('僕は学生です'), SENTENCE)).toBe(false);
  });
});
