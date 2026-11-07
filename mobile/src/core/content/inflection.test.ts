import { conjugatedFormNote } from './inflection';

describe('conjugatedFormNote', () => {
  it('names the taught form', () => {
    expect(conjugatedFormNote('来ない', '来る', 'nai')).toBe('来ない is the ない-form of 来る');
  });

  it('calls なくて / ないで the negative て-form', () => {
    expect(conjugatedFormNote('来なくて', '来る', 'nai')).toBe(
      '来なくて is the negative て-form of 来る',
    );
    expect(conjugatedFormNote('食べないで', '食べる', 'nai')).toBe(
      '食べないで is the negative て-form of 食べる',
    );
  });

  it('says nothing for the dictionary form', () => {
    expect(conjugatedFormNote('来る', '来る', 'nai')).toBeNull();
  });
});
