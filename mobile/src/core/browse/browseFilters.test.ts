import {
  BROWSE_FACET_KEYS,
  EMPTY_BROWSE_FILTERS,
  clearFacet,
  countActiveFacetValues,
  isBrowseFiltersEmpty,
  listFilterPills,
  summarizeFacet,
  toggleFacetValue,
} from '@/core/browse/browseFilters';

describe('EMPTY_BROWSE_FILTERS', () => {
  it('constrains nothing', () => {
    expect(isBrowseFiltersEmpty(EMPTY_BROWSE_FILTERS)).toBe(true);
    expect(countActiveFacetValues(EMPTY_BROWSE_FILTERS)).toBe(0);
  });

  it('covers every declared facet key', () => {
    for (const key of BROWSE_FACET_KEYS) {
      expect(EMPTY_BROWSE_FILTERS[key]).toEqual([]);
    }
  });
});

describe('toggleFacetValue', () => {
  it('adds a value that is not selected', () => {
    const next = toggleFacetValue(EMPTY_BROWSE_FILTERS, 'levels', 'N5');
    expect(next.levels).toEqual(['N5']);
  });

  it('removes a value that is already selected', () => {
    const selected = toggleFacetValue(EMPTY_BROWSE_FILTERS, 'levels', 'N5');
    expect(toggleFacetValue(selected, 'levels', 'N5').levels).toEqual([]);
  });

  it('does not mutate the input filters', () => {
    const before = { ...EMPTY_BROWSE_FILTERS };
    toggleFacetValue(EMPTY_BROWSE_FILTERS, 'types', 'kanji');
    expect(EMPTY_BROWSE_FILTERS).toEqual(before);
  });

  it('keeps facets independent', () => {
    const next = toggleFacetValue(
      toggleFacetValue(EMPTY_BROWSE_FILTERS, 'levels', 'N5'),
      'types',
      'kanji',
    );
    expect(next.levels).toEqual(['N5']);
    expect(next.types).toEqual(['kanji']);
  });
});

describe('clearFacet', () => {
  it('empties only the named facet', () => {
    const filters = toggleFacetValue(
      toggleFacetValue(EMPTY_BROWSE_FILTERS, 'levels', 'N5'),
      'types',
      'kanji',
    );

    const cleared = clearFacet(filters, 'levels');
    expect(cleared.levels).toEqual([]);
    expect(cleared.types).toEqual(['kanji']);
  });
});

describe('summarizeFacet', () => {
  it('names a single selection', () => {
    expect(summarizeFacet('levels', ['N5'])).toBe('N5');
    expect(summarizeFacet('lock', ['locked'])).toBe('Locked');
  });

  it('joins exactly two selections', () => {
    expect(summarizeFacet('types', ['vocabulary', 'grammar'])).toBe('Vocab + Grammar');
  });

  it('collapses three or more selections to a count', () => {
    expect(summarizeFacet('levels', ['N5', 'N4', 'N3'])).toBe('3 levels');
    expect(summarizeFacet('srsStages', ['guru', 'master', 'burned'])).toBe('3 stages');
  });

  it('falls back to the facet name when nothing is selected', () => {
    expect(summarizeFacet('levels', [])).toBe('Level');
    expect(summarizeFacet('performance', [])).toBe('Performance');
  });
});

describe('listFilterPills', () => {
  it('is empty when no facet is active', () => {
    expect(listFilterPills(EMPTY_BROWSE_FILTERS)).toEqual([]);
  });

  it('emits one self-summarizing pill per active facet', () => {
    const filters = {
      ...EMPTY_BROWSE_FILTERS,
      levels: ['N5' as const],
      types: ['vocabulary' as const, 'grammar' as const],
    };

    expect(listFilterPills(filters)).toEqual([
      { facet: 'levels', label: 'N5' },
      { facet: 'types', label: 'Vocab + Grammar' },
    ]);
  });
});
