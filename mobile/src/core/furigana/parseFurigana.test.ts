import { parseFurigana } from '@/core/furigana/parseFurigana';

function plainText(segments: ReturnType<typeof parseFurigana>): string {
  return segments.map((segment) => segment.text).join('');
}

describe('parseFurigana', () => {
  it('round-trips a multi-bracket sentence back to its plain text', () => {
    const annotated = '私[わたし]は学生[がくせい]です。';
    const segments = parseFurigana(annotated);
    expect(plainText(segments)).toBe('私は学生です。');
  });

  it('attaches the reading to the kanji run immediately before the bracket', () => {
    const segments = parseFurigana('食[た]べる');
    expect(segments).toContainEqual({ text: '食', reading: 'た' });
  });

  it('splits unannotated kana into single-character segments', () => {
    const segments = parseFurigana('たべる');
    expect(segments).toEqual([{ text: 'た' }, { text: 'べ' }, { text: 'る' }]);
  });

  it('merges trailing punctuation into the preceding segment', () => {
    const segments = parseFurigana('私[わたし]は学生[がくせい]です。');
    const last = segments[segments.length - 1];
    expect(last.text.endsWith('。')).toBe(true);
    expect(last.text).not.toBe('。');
  });

  it('keeps punctuation out of an annotated run so the reading survives a re-parse', () => {
    const segments = parseFurigana('明日[あした]、学[がっ]校[こう]に行[い]きます。');
    expect(segments[0]).toEqual({ text: '明日', reading: 'あした' });
    expect(segments[1]).toEqual({ text: '、' });
  });

  it('accepts katakana readings', () => {
    const segments = parseFurigana('東京[トウキョウ]');
    expect(segments).toContainEqual({ text: '東京', reading: 'トウキョウ' });
  });

  it('returns an empty array for an empty string', () => {
    expect(parseFurigana('')).toEqual([]);
  });

  it('degrades unbalanced brackets to a single unannotated segment', () => {
    const malformed = '私[わたしは学生[がくせい]です。';
    const segments = parseFurigana(malformed);
    expect(segments).toEqual([{ text: malformed }]);
  });

  it('degrades a non-kana reading to a single unannotated segment', () => {
    const malformed = '食[food]べる';
    const segments = parseFurigana(malformed);
    expect(segments).toEqual([{ text: malformed }]);
  });

  it('degrades a stray closing bracket to a single unannotated segment', () => {
    const malformed = '私]は学生[がくせい]です。';
    const segments = parseFurigana(malformed);
    expect(segments).toEqual([{ text: malformed }]);
  });

  it('never throws on malformed input', () => {
    expect(() => parseFurigana('[[[')).not.toThrow();
    expect(() => parseFurigana(']]]')).not.toThrow();
  });
});
