import {
  buildChatWordSpans,
  plainChatText,
  type ChatWordEntry,
  type ChatWordIndex,
} from '@/core/ai/chatWordSpans';

function index(entries: Record<string, ChatWordEntry>): ChatWordIndex {
  return new Map(Object.entries(entries));
}

const dictionary = (itemId: string): ChatWordEntry => ({ itemId, inflection: null });

const CURRICULUM = index({
  私: dictionary('watashi-n'),
  私たち: dictionary('watashitachi-n'),
  学生: dictionary('gakusei-n'),
  日本語: dictionary('nihongo-n'),
  食べる: dictionary('taberu-v'),
  来る: dictionary('kuru-v'),
  一緒に: dictionary('isshoni-adv'),
  食べました: { itemId: 'taberu-v', inflection: 'masu' },
  来ます: { itemId: 'kuru-v', inflection: 'masu' },
  見て: { itemId: 'miru-v', inflection: 'te' },
});

describe('buildChatWordSpans (15.1 — per-word linking of AI replies)', () => {
  it('links dictionary forms, with offsets into the plain reply', () => {
    const text = '私[わたし]は学生[がくせい]です。';

    expect(buildChatWordSpans(text, CURRICULUM)).toEqual([
      { vocabularyItemId: 'watashi-n', startOffset: 0, endOffset: 1, inflection: null },
      { vocabularyItemId: 'gakusei-n', startOffset: 2, endOffset: 4, inflection: null },
    ]);
    expect(plainChatText(text).slice(2, 4)).toBe('学生');
  });

  it('grows a match over the okurigana that follows the annotated run', () => {
    // The bracket run is 食 alone; べる is outside it, so a run-only match would
    // never find 食べる.
    expect(buildChatWordSpans('食[た]べる', CURRICULUM)).toEqual([
      { vocabularyItemId: 'taberu-v', startOffset: 0, endOffset: 3, inflection: null },
    ]);
  });

  it('links a taught conjugated surface to the base word and names the family (14.1)', () => {
    expect(buildChatWordSpans('猫[ねこ]がここへ来[き]ます。', CURRICULUM)).toEqual([
      { vocabularyItemId: 'kuru-v', startOffset: 5, endOffset: 8, inflection: 'masu' },
    ]);
    expect(buildChatWordSpans('食[た]べました', CURRICULUM)).toEqual([
      { vocabularyItemId: 'taberu-v', startOffset: 0, endOffset: 5, inflection: 'masu' },
    ]);
  });

  it('grows across separately annotated runs of one compound', () => {
    expect(buildChatWordSpans('日[に]本[ほん]語[ご]', CURRICULUM)).toEqual([
      { vocabularyItemId: 'nihongo-n', startOffset: 0, endOffset: 3, inflection: null },
    ]);
  });

  it('takes the longest match and resumes after it', () => {
    expect(buildChatWordSpans('私[わたし]たちは学生[がくせい]です', CURRICULUM)).toEqual([
      { vocabularyItemId: 'watashitachi-n', startOffset: 0, endOffset: 3, inflection: null },
      { vocabularyItemId: 'gakusei-n', startOffset: 4, endOffset: 6, inflection: null },
    ]);
  });

  it('keeps a trailing particle that belongs to the entry and drops one that does not', () => {
    expect(buildChatWordSpans('一緒[いっしょ]に', CURRICULUM)).toEqual([
      { vocabularyItemId: 'isshoni-adv', startOffset: 0, endOffset: 3, inflection: null },
    ]);
    expect(buildChatWordSpans('学生[がくせい]は', CURRICULUM)).toEqual([
      { vocabularyItemId: 'gakusei-n', startOffset: 0, endOffset: 2, inflection: null },
    ]);
  });

  it('never grows a span over punctuation', () => {
    // 。 is a candidate boundary, so the span stops before it even though the
    // parser merged it into the preceding segment.
    expect(buildChatWordSpans('見[み]て。', CURRICULUM)).toEqual([
      { vocabularyItemId: 'miru-v', startOffset: 0, endOffset: 2, inflection: 'te' },
    ]);
  });

  it('leaves off-curriculum words and untaught forms inert', () => {
    // 食べられる is a potential form: the base word is taught, this form is not,
    // and no span may claim it (14.1's taught-inflections-only scope).
    expect(buildChatWordSpans('食[た]べられる', CURRICULUM)).toEqual([]);
    expect(buildChatWordSpans('猫[ねこ]', CURRICULUM)).toEqual([]);
  });

  it('never segments kana-only text — nothing marks where those words begin', () => {
    const kanaOnly = index({ ...Object.fromEntries(CURRICULUM), これ: dictionary('kore-pn') });

    expect(buildChatWordSpans('これはペンです', kanaOnly)).toEqual([]);
  });

  it('degrades to no links on malformed bracket notation (OA6)', () => {
    expect(buildChatWordSpans('私[わたし は学生[がくせい]です', CURRICULUM)).toEqual([]);
  });

  it('returns nothing for an empty index (pre-14.1a curriculum)', () => {
    expect(buildChatWordSpans('私[わたし]です', new Map())).toEqual([]);
  });

  it('bounds how far one anchor may reach', () => {
    const longEntry = 'あ'.repeat(20);
    const overLong = index({ [`私${longEntry}`]: dictionary('too-long') });

    expect(buildChatWordSpans(`私[わたし]${longEntry}`, overLong)).toEqual([]);
  });
});

describe('plainChatText', () => {
  it('strips bracket notation', () => {
    expect(plainChatText('私[わたし]は学生[がくせい]です。')).toBe('私は学生です。');
  });

  it('hands back malformed input unchanged', () => {
    expect(plainChatText('壊[こわ れた')).toBe('壊[こわ れた');
  });
});
