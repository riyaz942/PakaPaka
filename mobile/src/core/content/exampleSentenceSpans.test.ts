import { buildExampleSentenceSpans } from '@/core/content/exampleSentenceSpans';

describe('buildExampleSentenceSpans', () => {
  it('returns no spans when there are no links', () => {
    expect(buildExampleSentenceSpans('私は学生です。', [])).toEqual([]);
  });

  it('locates the first primary_form match for each link', () => {
    expect(
      buildExampleSentenceSpans('私は学生です。', [
        { itemId: '10', primaryForm: '私' },
        { itemId: '11', primaryForm: '学生' },
      ]),
    ).toEqual([
      { vocabularyItemId: '10', startOffset: 0, endOffset: 1 },
      { vocabularyItemId: '11', startOffset: 2, endOffset: 4 },
    ]);
  });

  it('skips links whose primary_form is not in the sentence', () => {
    expect(
      buildExampleSentenceSpans('私は学生です。', [
        { itemId: '10', primaryForm: '私' },
        { itemId: '12', primaryForm: '見る' },
      ]),
    ).toEqual([{ vocabularyItemId: '10', startOffset: 0, endOffset: 1 }]);
  });

  it('prefers the longer form when shorter would overlap', () => {
    expect(
      buildExampleSentenceSpans('私たちは行きます。', [
        { itemId: '10', primaryForm: '私' },
        { itemId: '11', primaryForm: '私たち' },
      ]),
    ).toEqual([{ vocabularyItemId: '11', startOffset: 0, endOffset: 3 }]);
  });

  it('uses a later occurrence when the first overlaps a longer claim', () => {
    expect(
      buildExampleSentenceSpans('私たちは私です。', [
        { itemId: '10', primaryForm: '私' },
        { itemId: '11', primaryForm: '私たち' },
      ]),
    ).toEqual([
      { vocabularyItemId: '11', startOffset: 0, endOffset: 3 },
      { vocabularyItemId: '10', startOffset: 4, endOffset: 5 },
    ]);
  });
});
