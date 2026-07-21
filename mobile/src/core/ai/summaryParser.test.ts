import { parseSessionSummary } from '@/core/ai/summaryParser';

const validReply = JSON.stringify({
  mistakes: [{ quote: '私は行く', correction: '私は行きます', note: 'Use the polite form.' }],
  wordsMet: [{ text: '学生' }, { text: 'ラーメン' }],
  grammarNotes: ['Practised ～ています.'],
});

describe('parseSessionSummary', () => {
  it('parses a well-formed reply', () => {
    const result = parseSessionSummary(validReply);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mistakes).toEqual([
      { quote: '私は行く', correction: '私は行きます', note: 'Use the polite form.' },
    ]);
    expect(result.value.grammarNotes).toEqual(['Practised ～ています.']);
  });

  it('leaves curriculum membership unresolved — that is decided locally (FR92)', () => {
    const result = parseSessionSummary(validReply);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.wordsMet).toEqual([
      { text: '学生', itemId: null },
      { text: 'ラーメン', itemId: null },
    ]);
  });

  it('caps the mistake list at five (FR95)', () => {
    const reply = JSON.stringify({
      mistakes: Array.from({ length: 12 }, (_, index) => ({
        quote: `q${index}`,
        correction: `c${index}`,
        note: '',
      })),
      wordsMet: [],
      grammarNotes: [],
    });

    const result = parseSessionSummary(reply);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mistakes).toHaveLength(5);
  });

  it('drops a mistake with no correction rather than rendering an empty row', () => {
    const reply = JSON.stringify({
      mistakes: [
        { quote: 'a', correction: '', note: 'n' },
        { quote: 'b', correction: 'fixed', note: 'n' },
      ],
      wordsMet: [],
      grammarNotes: [],
    });

    const result = parseSessionSummary(reply);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mistakes).toHaveLength(1);
    expect(result.value.mistakes[0].correction).toBe('fixed');
  });

  it('tolerates a code fence and surrounding prose around the JSON', () => {
    const result = parseSessionSummary(`Here you go:\n\`\`\`json\n${validReply}\n\`\`\`\nHope that helps!`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mistakes).toHaveLength(1);
  });

  it('accepts wordsMet as bare strings as well as objects', () => {
    const result = parseSessionSummary(
      JSON.stringify({ mistakes: [], wordsMet: ['水', '本'], grammarNotes: [] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.wordsMet.map((word) => word.text)).toEqual(['水', '本']);
  });

  it('deduplicates repeated words', () => {
    const result = parseSessionSummary(
      JSON.stringify({ mistakes: [], wordsMet: ['水', '水', '本'], grammarNotes: [] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.wordsMet).toHaveLength(2);
  });

  it('accepts an empty but well-formed summary', () => {
    const result = parseSessionSummary(
      JSON.stringify({ mistakes: [], wordsMet: [], grammarNotes: [] }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mistakes).toEqual([]);
  });

  it('returns a Result error — never throws — on unparseable output', () => {
    for (const reply of ['', 'sorry, I cannot help', '{not json}', '[1,2,3]']) {
      expect(() => parseSessionSummary(reply)).not.toThrow();
      const result = parseSessionSummary(reply);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe('ai_summary_unparseable');
    }
  });

  it('substitutes empty arrays for missing fields instead of failing', () => {
    const result = parseSessionSummary(JSON.stringify({ mistakes: 'nope' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ mistakes: [], wordsMet: [], grammarNotes: [] });
  });
});
