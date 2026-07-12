import type { ReinforcementLink } from '@/core/content/content.types';

import { buildGrammarHintLevels } from './hintLevels';

const reinforcementLink: ReinforcementLink = {
  relatedItemId: '42',
  primaryForm: '学生',
  meaning: 'student',
  relationshipType: 'reinforces',
  srsStageLabel: 'guru',
  recencyPhrase: 'yesterday',
  displayText: 'Reinforces 学生 (student)',
};

describe('buildGrammarHintLevels (Plan 10 two-rung ladder)', () => {
  it('orders nudge before English', () => {
    const levels = buildGrammarHintLevels({
      nudge: 'Marks the topic',
      english: 'I am a student.',
      englishAllowed: true,
    });
    expect(levels.map((l) => l.content)).toEqual(['Marks the topic', 'I am a student.']);
  });

  it('drops the English rung when englishAllowed is false (Enlightened gate)', () => {
    const levels = buildGrammarHintLevels({
      nudge: 'Marks the topic',
      english: 'I am a student.',
      englishAllowed: false,
      reinforcementLink,
    });
    expect(levels).toEqual([{ content: 'Marks the topic' }]);
  });

  it('keeps reinforcement as a final rung pre-Enlightened', () => {
    const levels = buildGrammarHintLevels({
      nudge: 'Marks the topic',
      english: 'I am a student.',
      englishAllowed: true,
      reinforcementLink,
    });
    expect(levels[2]).toEqual({
      content: 'Reinforces 学生 (student)',
      isReinforcement: true,
    });
  });

  it('omits empty or whitespace-only rungs', () => {
    expect(
      buildGrammarHintLevels({ nudge: '  ', english: null, englishAllowed: true }),
    ).toEqual([]);
    expect(
      buildGrammarHintLevels({ nudge: null, english: 'EN', englishAllowed: true }),
    ).toEqual([{ content: 'EN' }]);
  });
});
