import { extractWordCandidates } from '@/core/ai/wordCandidates';

describe('extractWordCandidates', () => {
  it('offers each annotated kanji run as a candidate', () => {
    expect(extractWordCandidates('私[わたし]は学生[がくせい]です。')).toEqual(['私', '学生']);
  });

  it('strips trailing punctuation folded into a segment', () => {
    expect(extractWordCandidates('元気[げんき]。')).toEqual(['元気']);
  });

  it('deduplicates a word repeated in the same reply', () => {
    expect(extractWordCandidates('本[ほん]と本[ほん]')).toEqual(['本']);
  });

  it('returns nothing for kana-only text rather than guessing word boundaries', () => {
    expect(extractWordCandidates('こんにちは、げんきですか')).toEqual([]);
  });

  it('returns nothing for an empty reply', () => {
    expect(extractWordCandidates('')).toEqual([]);
  });

  it('degrades to no candidates when the brackets are malformed', () => {
    // parseFurigana collapses malformed input to one unannotated segment, so
    // there is nothing to offer — and crucially, this must not throw.
    expect(() => extractWordCandidates('壊[こわ れた')).not.toThrow();
    expect(extractWordCandidates('壊[こわ れた')).toEqual([]);
  });
});
