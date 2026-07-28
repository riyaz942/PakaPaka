import { buildPassageBodyParts } from '@/core/content/passageBodyParts';

describe('buildPassageBodyParts', () => {
  it('returns one inert part when there are no spans', () => {
    const parts = buildPassageBodyParts('私は学生です。', null, []);

    expect(parts).toEqual([
      { vocabularyItemId: null, text: '私は学生です。', surface: '私は学生です。' },
    ]);
  });

  it('splits plain text into span and interstitial parts', () => {
    // 私 / は / 学生 / です。
    const parts = buildPassageBodyParts('私は学生です。', null, [
      { vocabularyItemId: '10', startOffset: 0, endOffset: 1 },
      { vocabularyItemId: '11', startOffset: 2, endOffset: 4 },
    ]);

    expect(parts).toEqual([
      { vocabularyItemId: '10', text: '私', surface: '私' },
      { vocabularyItemId: null, text: 'は', surface: 'は' },
      { vocabularyItemId: '11', text: '学生', surface: '学生' },
      { vocabularyItemId: null, text: 'です。', surface: 'です。' },
    ]);
  });

  it('keeps furigana readings attached inside and outside spans', () => {
    const parts = buildPassageBodyParts(
      '私は学生です。',
      '私[わたし]は学生[がくせい]です。',
      [{ vocabularyItemId: '11', startOffset: 2, endOffset: 4 }],
    );

    expect(parts).toEqual([
      { vocabularyItemId: null, text: '私[わたし]は', surface: '私は' },
      { vocabularyItemId: '11', text: '学生[がくせい]', surface: '学生' },
      { vocabularyItemId: null, text: 'です。', surface: 'です。' },
    ]);
  });

  it('keeps adjacent spans as separate runs', () => {
    const parts = buildPassageBodyParts('私は', null, [
      { vocabularyItemId: '10', startOffset: 0, endOffset: 1 },
      { vocabularyItemId: '11', startOffset: 1, endOffset: 2 },
    ]);

    expect(parts).toEqual([
      { vocabularyItemId: '10', text: '私', surface: '私' },
      { vocabularyItemId: '11', text: 'は', surface: 'は' },
    ]);
  });

  it('ignores spans that fall outside the body', () => {
    const parts = buildPassageBodyParts('私は', null, [
      { vocabularyItemId: '10', startOffset: 5, endOffset: 9 },
    ]);

    expect(parts).toEqual([{ vocabularyItemId: null, text: '私は', surface: '私は' }]);
  });

  it('ignores spans with a non-increasing range', () => {
    const parts = buildPassageBodyParts('私は', null, [
      { vocabularyItemId: '10', startOffset: 1, endOffset: 1 },
    ]);

    expect(parts).toEqual([{ vocabularyItemId: null, text: '私は', surface: '私は' }]);
  });

  it('reproduces the whole body across all parts', () => {
    const body = '昨日、友達とレストランへ行きました。';
    const parts = buildPassageBodyParts(body, null, [
      { vocabularyItemId: '10', startOffset: 0, endOffset: 2 },
      { vocabularyItemId: '11', startOffset: 3, endOffset: 5 },
      { vocabularyItemId: '12', startOffset: 6, endOffset: 11 },
    ]);

    expect(parts.map((part) => part.surface).join('')).toBe(body);
    expect(parts.filter((part) => part.vocabularyItemId !== null).map((part) => part.surface))
      .toEqual(['昨日', '友達', 'レストラン']);
  });

  it('never cuts an annotated run in half when a span lands mid-reading', () => {
    // The span covers only 学, but 学生[がくせい] is one atomic reading.
    const parts = buildPassageBodyParts('私は学生です。', '私[わたし]は学生[がくせい]です。', [
      { vocabularyItemId: '11', startOffset: 2, endOffset: 3 },
    ]);

    const spanPart = parts.find((part) => part.vocabularyItemId === '11');
    expect(spanPart?.text).toBe('学生[がくせい]');
    expect(parts.map((part) => part.surface).join('')).toBe('私は学生です。');
  });

  it('emits re-parseable notation for a span that punctuation follows', () => {
    const parts = buildPassageBodyParts('明日、学校に行きます。', '明日[あした]、学[がっ]校[こう]に行[い]きます。', [
      { vocabularyItemId: '214', startOffset: 0, endOffset: 2 },
    ]);

    const spanPart = parts.find((part) => part.vocabularyItemId === '214');
    expect(spanPart?.text).toBe('明日[あした]');
    expect(spanPart?.surface).toBe('明日');
    expect(parts.map((part) => part.surface).join('')).toBe('明日、学校に行きます。');
  });
});
