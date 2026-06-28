import { buildRecencyPhrase, resolveReinforcement } from './reinforcementResolver';
import type { RelatedItem, ReinforcementSrsSnapshot } from './content.types';

const NOW = new Date('2026-06-28T12:00:00.000Z');

function makeRelated(overrides: Partial<RelatedItem> = {}): RelatedItem {
  return {
    id: '20',
    itemType: 'vocabulary',
    primaryForm: '食べる',
    meaning: 'to eat',
    relationshipType: 'reinforces',
    ...overrides,
  };
}

function makeSrs(overrides: Partial<ReinforcementSrsSnapshot> = {}): ReinforcementSrsSnapshot {
  return {
    srsStageLabel: 'guru',
    updatedAt: '2026-06-27T12:00:00.000Z',
    fsrsState: 'review',
    reps: 3,
    ...overrides,
  };
}

describe('buildRecencyPhrase', () => {
  it('returns yesterday phrase for ~24h ago', () => {
    expect(buildRecencyPhrase(makeSrs({ updatedAt: '2026-06-27T12:00:00.000Z' }), NOW)).toBe(
      'you learned this yesterday',
    );
  });

  it('falls back to stage label for older reviews', () => {
    expect(buildRecencyPhrase(makeSrs({ updatedAt: '2026-06-01T12:00:00.000Z' }), NOW)).toBe(
      'Guru stage',
    );
  });
});

describe('resolveReinforcement', () => {
  it('returns empty array when no related items', () => {
    expect(
      resolveReinforcement({ itemId: '50', itemType: 'grammar' }, [], new Map(), { now: NOW }),
    ).toEqual([]);
  });

  it('excludes unstudied targets', () => {
    const related = makeRelated();
    const map = new Map<string, ReinforcementSrsSnapshot | null>([
      ['20', { srsStageLabel: 'apprentice', updatedAt: NOW.toISOString(), fsrsState: 'new', reps: 0 }],
    ]);

    expect(
      resolveReinforcement({ itemId: '50', itemType: 'grammar' }, [related], map, { now: NOW }),
    ).toEqual([]);
  });

  it('returns a ranked link for studied targets', () => {
    const vocab = makeRelated();
    const radical = makeRelated({
      id: '2',
      itemType: 'radical',
      primaryForm: '口',
      meaning: 'mouth',
      relationshipType: 'builds_on',
    });

    const map = new Map<string, ReinforcementSrsSnapshot | null>([
      ['20', makeSrs({ srsStageLabel: 'guru', updatedAt: '2026-06-27T12:00:00.000Z' })],
      ['2', makeSrs({ srsStageLabel: 'apprentice', updatedAt: '2026-06-20T12:00:00.000Z' })],
    ]);

    const links = resolveReinforcement(
      { itemId: '50', itemType: 'grammar' },
      [radical, vocab],
      map,
      { now: NOW },
    );

    expect(links).toHaveLength(2);
    expect(links[0].relatedItemId).toBe('20');
    expect(links[0].displayText).toBe('食べる — you learned this yesterday');
    expect(links[1].displayText).toBe('Uses radical 口 (mouth) — Apprentice stage');
  });

  it('is deterministic with injected now', () => {
    const related = makeRelated();
    const map = new Map<string, ReinforcementSrsSnapshot | null>([
      ['20', makeSrs()],
    ]);

    const a = resolveReinforcement({ itemId: '50', itemType: 'grammar' }, [related], map, {
      now: NOW,
    });
    const b = resolveReinforcement({ itemId: '50', itemType: 'grammar' }, [related], map, {
      now: NOW,
    });

    expect(a).toEqual(b);
  });
});
