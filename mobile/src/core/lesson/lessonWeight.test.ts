import { lessonWeight } from './lessonWeight';

describe('lessonWeight', () => {
  it('radical is light', () => expect(lessonWeight({ itemType: 'radical' })).toBe('light'));
  it('grammar is heavy', () => expect(lessonWeight({ itemType: 'grammar' })).toBe('heavy'));
  it.each([
    [1, 'light'],
    [2, 'normal'],
    [3, 'heavy'],
    [4, 'heavy'],
  ])('kanji with %i components is %s', (n, w) =>
    expect(lessonWeight({ itemType: 'kanji', radicalComponentCount: n })).toBe(w),
  );
  it.each([
    ['Kana only — これ.', 'noun', 'light'],
    ["Kun'yomi — 私（わたし）.", 'pronoun', 'normal'],
    ["On'yomi — 本（ほん）.", 'noun', 'normal'],
    ['Jukugo — 学生（がくせい）.', 'noun', 'normal'],
    ['Jukugo — 勉強する.', 'godan verb, transitive verb', 'heavy'],
    ['Irregular — 今日（きょう）.', 'noun', 'heavy'],
    ['Mixed — 毎朝.', 'noun', 'heavy'],
    [null, null, 'normal'],
    ['Something else', 'noun', 'normal'],
  ])('vocabulary %s / %s is %s', (rc, wt, w) =>
    expect(
      lessonWeight({ itemType: 'vocabulary', readingComposition: rc, wordType: wt }),
    ).toBe(w),
  );
  it('adverb is not a verb', () =>
    expect(
      lessonWeight({
        itemType: 'vocabulary',
        readingComposition: 'Jukugo — 大変.',
        wordType: 'adverb, noun',
      }),
    ).toBe('normal'));
});
