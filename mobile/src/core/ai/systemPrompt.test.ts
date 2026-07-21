import { WRAP_UP_MARKER } from '@/core/ai/markers';
import {
  buildConversationSystemPrompt,
  buildSummarySystemPrompt,
} from '@/core/ai/systemPrompt';

describe('buildConversationSystemPrompt', () => {
  it('asks for curriculum furigana bracket notation (FR91)', () => {
    const prompt = buildConversationSystemPrompt({ mode: 'random', turnBudget: 8 });

    expect(prompt).toContain('私[わたし]は学生[がくせい]です。');
    expect(prompt.toLowerCase()).toContain('kana');
  });

  it('teaches the wrap-up sentinel and tells the model to keep it hidden (FR97)', () => {
    const prompt = buildConversationSystemPrompt({ mode: 'random', turnBudget: 8 });

    expect(prompt).toContain(WRAP_UP_MARKER);
    expect(prompt).toContain('never mention or explain it');
  });

  it('states the turn budget as a steer, not a cutoff (OA4)', () => {
    const prompt = buildConversationSystemPrompt({ mode: 'random', turnBudget: 12 });

    expect(prompt).toContain('12');
    expect(prompt).toContain('not a hard limit');
  });

  it('forbids mid-conversation correction (FR94 — coaching comes after the end)', () => {
    const prompt = buildConversationSystemPrompt({ mode: 'random', turnBudget: 8 });

    expect(prompt).toContain('Do not correct the learner mid-conversation');
  });

  it('varies the framing per mode', () => {
    const rolePlay = buildConversationSystemPrompt({ mode: 'role_play', turnBudget: 8 });
    const random = buildConversationSystemPrompt({ mode: 'random', turnBudget: 8 });

    expect(rolePlay).toContain('character');
    expect(rolePlay).not.toBe(random);
  });

  it('includes grammar topics when supplied', () => {
    const prompt = buildConversationSystemPrompt({
      mode: 'choose_grammar',
      turnBudget: 8,
      grammarTopics: [
        {
          primaryForm: '～ている',
          meaning: 'ongoing action',
          structure: 'Verb-te + iru',
          exampleSentences: ['本[ほん]を読[よ]んでいます。'],
        },
      ],
    });

    expect(prompt).toContain('～ている');
    expect(prompt).toContain('ongoing action');
    expect(prompt).toContain('Verb-te + iru');
    expect(prompt).toContain('本[ほん]を読[よ]んでいます。');
  });

  it('omits the grammar section entirely when there are no topics', () => {
    const prompt = buildConversationSystemPrompt({ mode: 'random', turnBudget: 8 });

    expect(prompt).not.toContain('Grammar to practise');
  });
});

describe('buildSummarySystemPrompt', () => {
  it('asks for bare JSON in the shape the parser expects', () => {
    const prompt = buildSummarySystemPrompt();

    expect(prompt).toContain('"mistakes"');
    expect(prompt).toContain('"wordsMet"');
    expect(prompt).toContain('"grammarNotes"');
    expect(prompt).toContain('no code fence');
  });

  it('caps mistakes at five and leaves word membership to the app (FR92, FR95)', () => {
    const prompt = buildSummarySystemPrompt();

    expect(prompt).toContain('at most five');
    expect(prompt).toContain('the app decides that locally');
  });
});
