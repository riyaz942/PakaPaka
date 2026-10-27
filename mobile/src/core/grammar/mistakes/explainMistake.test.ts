import type { Mistake } from './mistake.types';
import { explainMistake } from './explainMistake';

const mistake = (over: Partial<Mistake>): Mistake => ({
  kind: 'wrong_word',
  rawStart: 0,
  rawEnd: 0,
  typed: '',
  expected: [],
  before: null,
  after: null,
  ...over,
});
const explain = (over: Partial<Mistake>) => explainMistake(mistake(over), '〜たい');

describe('explainMistake', () => {
  describe('particles', () => {
    it('missing between two words', () => {
      expect(
        explain({
          kind: 'particle_missing',
          expected: ['は'],
          before: '今年',
          after: '学校',
        }),
      ).toBe('Between 今年 and 学校, you need は. Your answer has no particle there.');
    });
    it('missing with no next word', () => {
      expect(explain({ kind: 'particle_missing', expected: ['を'], before: '本' })).toBe(
        'After 本, you need を. Your answer has no particle there.',
      );
    });
    it('missing at the start', () => {
      expect(explain({ kind: 'particle_missing', expected: ['は'], after: '学校' })).toBe(
        'Before 学校, you need は. Your answer has no particle there.',
      );
    });
    it('missing with no neighbours', () => {
      expect(explain({ kind: 'particle_missing', expected: ['は'] })).toBe(
        'You need は. Your answer has no particle there.',
      );
    });
    it('wrong', () => {
      expect(
        explain({
          kind: 'particle_wrong',
          typed: 'に',
          expected: ['で'],
          before: '学校',
        }),
      ).toBe('After 学校, you used に. This sentence needs で.');
    });
    it('wrong with several accepted particles', () => {
      expect(
        explain({
          kind: 'particle_wrong',
          typed: 'で',
          expected: ['に', 'へ'],
          before: '家',
        }),
      ).toBe('After 家, you used で. This sentence needs に or へ.');
    });
    it('wrong at the start', () => {
      expect(
        explain({
          kind: 'particle_wrong',
          typed: 'を',
          expected: ['は'],
          after: '食べる',
        }),
      ).toBe('Before 食べる, you used を. This sentence needs は.');
    });
    it('wrong with no neighbours', () => {
      expect(explain({ kind: 'particle_wrong', typed: 'を', expected: ['は'] })).toBe(
        'You used を. This sentence needs は.',
      );
    });
    it('extra', () => {
      expect(explain({ kind: 'particle_extra', typed: 'を', before: '学校' })).toBe(
        'After 学校, you added を. This sentence has no particle there.',
      );
    });
    it('extra at the start', () => {
      expect(explain({ kind: 'particle_extra', typed: 'を', after: '学校' })).toBe(
        'Before 学校, you added を. This sentence has no particle there.',
      );
    });
    it('extra with no neighbours', () => {
      expect(explain({ kind: 'particle_extra', typed: 'を' })).toBe(
        'You added を. This sentence has no particle there.',
      );
    });
  });

  describe('form', () => {
    it('register', () => {
      expect(
        explain({
          kind: 'form',
          typed: '食べる',
          expected: ['食べます'],
          dims: { register: 'polite' },
        }),
      ).toBe('You wrote 食べる. This card asks for polite form: 食べます.');
      expect(
        explain({
          kind: 'form',
          typed: '食べます',
          expected: ['食べる'],
          dims: { register: 'plain' },
        }),
      ).toBe('You wrote 食べます. This card asks for plain form: 食べる.');
    });
    it('tense', () => {
      expect(
        explain({
          kind: 'form',
          typed: '行きます',
          expected: ['行きました'],
          dims: { tense: 'past' },
        }),
      ).toBe('You wrote 行きます. The English is past: 行きました.');
      expect(
        explain({
          kind: 'form',
          typed: '行った',
          expected: ['行く'],
          dims: { tense: 'non-past' },
        }),
      ).toBe('You wrote 行った. The English is not past: 行く.');
    });
    it('polarity', () => {
      expect(
        explain({
          kind: 'form',
          typed: '食べる',
          expected: ['食べない'],
          dims: { polarity: 'negative' },
        }),
      ).toBe('You wrote 食べる. The English is negative: 食べない.');
      expect(
        explain({
          kind: 'form',
          typed: '食べない',
          expected: ['食べる'],
          dims: { polarity: 'positive' },
        }),
      ).toBe('You wrote 食べない. The English is positive: 食べる.');
    });
    it('two dims, in register, tense, polarity order', () => {
      expect(
        explain({
          kind: 'form',
          typed: '食べる',
          expected: ['食べました'],
          dims: { tense: 'past', register: 'polite' },
        }),
      ).toBe('You wrote 食べる. This card asks for polite past: 食べました.');
      expect(
        explain({
          kind: 'form',
          typed: '食べる',
          expected: ['食べませんでした'],
          dims: { polarity: 'negative', tense: 'past', register: 'polite' },
        }),
      ).toBe('You wrote 食べる. This card asks for polite past negative: 食べませんでした.');
    });
    it('falls back to the wrong_word line without dims', () => {
      expect(explain({ kind: 'form', typed: '食べる', expected: ['食べます'] })).toBe(
        'You wrote 食べる. This sentence needs 食べます.',
      );
    });
  });

  describe('verb_group', () => {
    it('godan class reads as う-verb', () => {
      expect(
        explain({
          kind: 'verb_group',
          typed: '帰ます',
          expected: ['帰ります'],
          dictForm: '帰る',
          conjugationClass: 'godan',
        }),
      ).toBe('You wrote 帰ます. 帰る is a う-verb: 帰ります.');
      expect(
        explain({
          kind: 'verb_group',
          typed: 'x',
          expected: ['y'],
          dictForm: '行く',
          conjugationClass: 'godan-iku',
        }),
      ).toBe('You wrote x. 行く is a う-verb: y.');
    });
    it('ichidan reads as る-verb', () => {
      expect(
        explain({
          kind: 'verb_group',
          typed: '食べいます',
          expected: ['食べます'],
          dictForm: '食べる',
          conjugationClass: 'ichidan',
        }),
      ).toBe('You wrote 食べいます. 食べる is a る-verb: 食べます.');
    });
    it('falls back to the wrong_word line without a class', () => {
      expect(
        explain({
          kind: 'verb_group',
          typed: '帰ます',
          expected: ['帰ります'],
          dictForm: '帰る',
        }),
      ).toBe('You wrote 帰ます. This sentence needs 帰ります.');
    });
    it('falls back when the class is not a verb group', () => {
      expect(
        explain({
          kind: 'verb_group',
          typed: 'a',
          expected: ['b'],
          dictForm: 'する',
          conjugationClass: 'suru',
        }),
      ).toBe('You wrote a. This sentence needs b.');
    });
  });

  describe('te_ta', () => {
    it('names the last kana and the tail', () => {
      expect(
        explain({
          kind: 'te_ta',
          typed: '書って',
          expected: ['書いて'],
          dictForm: '書く',
        }),
      ).toBe('You wrote 書って. く verbs change to いて: 書いて.');
      expect(
        explain({
          kind: 'te_ta',
          typed: '飲んた',
          expected: ['飲んだ'],
          dictForm: '飲む',
        }),
      ).toBe('You wrote 飲んた. む verbs change to んだ: 飲んだ.');
    });
    it('godan-iku is special', () => {
      expect(
        explain({
          kind: 'te_ta',
          typed: '行いて',
          expected: ['行って'],
          dictForm: '行く',
          conjugationClass: 'godan-iku',
        }),
      ).toBe('You wrote 行いて. 行く is special: 行って.');
    });
    it('falls back when the answer is kana but dictForm is kanji', () => {
      expect(
        explain({ kind: 'te_ta', typed: 'いうて', expected: ['いって'], dictForm: '言う' }),
      ).toBe('You wrote いうて. This sentence needs いって.');
    });
    it('falls back without dictForm', () => {
      expect(explain({ kind: 'te_ta', typed: '書って', expected: ['書いて'] })).toBe(
        'You wrote 書って. This sentence needs 書いて.',
      );
    });
  });

  describe('adjective_type', () => {
    it('na-adjective', () => {
      expect(
        explain({
          kind: 'adjective_type',
          typed: 'きれいくない',
          expected: ['きれいじゃない'],
          dictForm: 'きれい',
          conjugationClass: 'adj-na',
        }),
      ).toBe('You wrote きれいくない. きれい is a な-adjective: きれいじゃない.');
    });
    it('i-adjective, both i classes', () => {
      for (const cls of ['adj-i', 'adj-ii'] as const) {
        expect(
          explain({
            kind: 'adjective_type',
            typed: '高いじゃない',
            expected: ['高くない'],
            dictForm: '高い',
            conjugationClass: cls,
          }),
        ).toBe('You wrote 高いじゃない. 高い is a い-adjective: 高くない.');
      }
    });
    it('falls back without a class', () => {
      expect(
        explain({
          kind: 'adjective_type',
          typed: 'a',
          expected: ['b'],
          dictForm: 'c',
        }),
      ).toBe('You wrote a. This sentence needs b.');
    });
  });

  describe('transitivity', () => {
    it('names the verb the answer needs', () => {
      expect(
        explain({
          kind: 'transitivity',
          typed: '開く',
          expected: ['開ける'],
          transitivity: 'transitive',
        }),
      ).toBe('You wrote 開く. This sentence needs the transitive verb 開ける.');
      expect(
        explain({
          kind: 'transitivity',
          typed: '開ける',
          expected: ['開く'],
          transitivity: 'intransitive',
        }),
      ).toBe('You wrote 開ける. This sentence needs the intransitive verb 開く.');
    });
    it('falls back without transitivity', () => {
      expect(explain({ kind: 'transitivity', typed: '開く', expected: ['開ける'] })).toBe(
        'You wrote 開く. This sentence needs 開ける.',
      );
    });
  });

  describe('other kinds', () => {
    it('does not print broken text when expected is empty', () => {
      expect(explain({ kind: 'word_missing' })).toBe('Your answer has a mistake here.');
      expect(explain({ kind: 'wrong_word', typed: '犬' })).toBe('You wrote 犬.');
    });
    it('grammar_not_used', () => {
      expect(explain({ kind: 'grammar_not_used' })).toBe('This card tests 〜たい.');
    });
    it('wrong_word', () => {
      expect(explain({ kind: 'wrong_word', typed: '犬', expected: ['猫'] })).toBe(
        'You wrote 犬. This sentence needs 猫.',
      );
    });
    it('word_missing', () => {
      expect(explain({ kind: 'word_missing', expected: ['猫'] })).toBe('You did not write 猫.');
    });
    it('word_extra', () => {
      expect(explain({ kind: 'word_extra', typed: '犬' })).toBe(
        'You added 犬. This sentence does not have it.',
      );
    });
    it('word_order', () => {
      expect(explain({ kind: 'word_order' })).toBe('All words are correct. The order is not.');
    });
    it('spelling_sokuon', () => {
      expect(
        explain({
          kind: 'spelling_sokuon',
          typed: 'きて',
          expected: ['きって'],
        }),
      ).toBe('Small っ is missing: きって.');
    });
    it('spelling_long_vowel', () => {
      expect(
        explain({
          kind: 'spelling_long_vowel',
          typed: 'おさん',
          expected: ['おとうさん'],
        }),
      ).toBe('Long vowel is missing: おとうさん.');
    });
    it('homophone_kanji', () => {
      expect(explain({ kind: 'homophone_kanji', typed: '橋', expected: ['箸'] })).toBe(
        'Same sound, different kanji: 箸.',
      );
    });
  });
});
