import { buildSearchBranches } from '@/core/browse/browseSearch';

describe('buildSearchBranches', () => {
  it('returns null for blank queries so callers skip the search predicate entirely', () => {
    expect(buildSearchBranches('')).toBeNull();
    expect(buildSearchBranches('   ')).toBeNull();
  });

  it('trims the query and always keeps the raw text as a branch', () => {
    const branches = buildSearchBranches('  water  ');
    expect(branches?.raw).toBe('water');
    expect(branches?.all).toContain('water');
  });

  it('adds hiragana and katakana branches for romaji without replacing the raw query', () => {
    const branches = buildSearchBranches('nihon');

    expect(branches?.raw).toBe('nihon');
    expect(branches?.kana).toContain('にほん');
    expect(branches?.kana).toContain('ニホン');
    // The raw romaji must survive — an English meaning like "nihon" should
    // still match even though we also probe the kana forms.
    expect(branches?.all[0]).toBe('nihon');
  });

  it('keeps the convertible kana prefix when a partial romaji tail cannot convert', () => {
    // "nihonk" leaves a dangling consonant; the kana branch must still probe
    // "にほん" rather than the unmatchable "にほんk".
    const branches = buildSearchBranches('nihonk');

    expect(branches?.raw).toBe('nihonk');
    expect(branches?.kana).toContain('にほん');
    expect(branches?.kana.every((branch) => !/[a-z]/i.test(branch))).toBe(true);
  });

  it('produces no kana branches when nothing converts', () => {
    const branches = buildSearchBranches('!!');
    expect(branches?.raw).toBe('!!');
    expect(branches?.kana).toEqual([]);
  });

  it('does not add kana branches for queries already written in Japanese', () => {
    const branches = buildSearchBranches('水');
    expect(branches?.raw).toBe('水');
    expect(branches?.kana).toEqual([]);
    expect(branches?.all).toEqual(['水']);
  });

  it('deduplicates branches', () => {
    const branches = buildSearchBranches('n');
    const unique = new Set(branches?.all ?? []);
    expect(unique.size).toBe(branches?.all.length);
  });
});
