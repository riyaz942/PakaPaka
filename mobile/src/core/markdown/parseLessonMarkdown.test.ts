import {
  parseInlineSpans,
  parseLessonMarkdown,
  spansHaveFurigana,
  tokenizeSpans,
} from '@/core/markdown/parseLessonMarkdown';

describe('parseLessonMarkdown', () => {
  it('parses headings, paragraphs, and soft-wrapped lines', () => {
    const blocks = parseLessonMarkdown('# です\n\nFirst line\ncontinues here.\n\n## Usage');

    expect(blocks).toEqual([
      { type: 'heading', level: 1, spans: [{ text: 'です' }] },
      { type: 'paragraph', spans: [{ text: 'First line continues here.' }] },
      { type: 'heading', level: 2, spans: [{ text: 'Usage' }] },
    ]);
  });

  it('parses jp fences into jp blocks and other fences into code blocks', () => {
    const blocks = parseLessonMarkdown(
      '```jp\n私[わたし]は学生[がくせい]です。\n```\n\n```\nNoun + です\n```',
    );

    expect(blocks).toEqual([
      { type: 'jp', lines: ['私[わたし]は学生[がくせい]です。'] },
      { type: 'code', lines: ['Noun + です'] },
    ]);
  });

  it('parses blockquotes into callouts', () => {
    const blocks = parseLessonMarkdown('> Watch out —\n> this trips people up.');

    expect(blocks).toEqual([
      { type: 'callout', spans: [{ text: 'Watch out — this trips people up.' }] },
    ]);
  });

  it('parses bullet and ordered lists', () => {
    const blocks = parseLessonMarkdown('- first\n- second\n\n1. one\n2. two');

    expect(blocks).toEqual([
      { type: 'list', ordered: false, items: [[{ text: 'first' }], [{ text: 'second' }]] },
      { type: 'list', ordered: true, items: [[{ text: 'one' }], [{ text: 'two' }]] },
    ]);
  });

  it('survives an unclosed fence without dropping content', () => {
    const blocks = parseLessonMarkdown('```jp\n猫[ねこ]です。');

    expect(blocks).toEqual([{ type: 'jp', lines: ['猫[ねこ]です。'] }]);
  });
});

describe('parseInlineSpans', () => {
  it('splits bold, italic, and code spans', () => {
    expect(parseInlineSpans('plain **bold** and *italic* and `code` end')).toEqual([
      { text: 'plain ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'italic', italic: true },
      { text: ' and ' },
      { text: 'code', code: true },
      { text: ' end' },
    ]);
  });

  it('returns the whole text as one span when unmarked', () => {
    expect(parseInlineSpans('nothing fancy')).toEqual([{ text: 'nothing fancy' }]);
  });
});

describe('tokenizeSpans', () => {
  it('keeps latin words whole with trailing whitespace attached', () => {
    const tokens = tokenizeSpans([{ text: 'two words' }]);

    expect(tokens).toEqual([
      { kind: 'word', text: 'two ', bold: undefined, italic: undefined, code: undefined },
      { kind: 'word', text: 'words', bold: undefined, italic: undefined, code: undefined },
    ]);
  });

  it('emits ruby tokens for annotated runs and per-character tokens for plain Japanese', () => {
    const tokens = tokenizeSpans([{ text: 'the word 学生[がくせい]とは' }]);

    expect(tokens.map((token) => ({ kind: token.kind, text: token.text }))).toEqual([
      { kind: 'word', text: 'the ' },
      { kind: 'word', text: 'word ' },
      { kind: 'ruby', text: '学生' },
      { kind: 'word', text: 'と' },
      { kind: 'word', text: 'は' },
    ]);
    expect(tokens[2].reading).toBe('がくせい');
  });

  it('merges closing Japanese punctuation into the preceding token', () => {
    const tokens = tokenizeSpans([{ text: 'です。' }]);

    expect(tokens.map((token) => token.text)).toEqual(['で', 'す。']);
  });

  it('carries inline style flags onto tokens', () => {
    const tokens = tokenizeSpans([{ text: 'strong', bold: true }]);

    expect(tokens).toEqual([
      { kind: 'word', text: 'strong', bold: true, italic: undefined, code: undefined },
    ]);
  });
});

describe('spansHaveFurigana', () => {
  it('detects bracket annotations', () => {
    expect(spansHaveFurigana([{ text: '私[わたし]は' }])).toBe(true);
    expect(spansHaveFurigana([{ text: 'plain English' }])).toBe(false);
    expect(spansHaveFurigana([{ text: 'ひらがなだけ' }])).toBe(false);
  });
});
