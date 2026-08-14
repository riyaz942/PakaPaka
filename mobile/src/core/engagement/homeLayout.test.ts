import {
  defaultHomeLayout,
  HOME_SECTION_CATALOG,
  reconcileHomeLayout,
  serializeHomeLayout,
  type HomeSectionEntry,
} from './homeLayout';

const DEFAULT_ORDER = [
  'goal-ring',
  'review-cta',
  'lesson-cta',
  'level-progress',
  'review-forecast',
  'reading-readiness',
  'at-risk',
];

function ids(entries: HomeSectionEntry[]): string[] {
  return entries.map((entry) => entry.id);
}

describe('defaultHomeLayout', () => {
  it('is the current Home order with everything visible', () => {
    const layout = defaultHomeLayout();
    expect(ids(layout)).toEqual(DEFAULT_ORDER);
    expect(layout.every((entry) => entry.visible)).toBe(true);
  });
});

describe('reconcileHomeLayout', () => {
  it('returns the default layout when nothing is stored', () => {
    expect(reconcileHomeLayout(null)).toEqual(defaultHomeLayout());
  });

  it('returns the default layout for unparseable JSON', () => {
    expect(reconcileHomeLayout('{not json')).toEqual(defaultHomeLayout());
  });

  it('returns the default layout for a wrong version', () => {
    const stored = JSON.stringify({ v: 2, sections: [{ id: 'at-risk', visible: true }] });
    expect(reconcileHomeLayout(stored)).toEqual(defaultHomeLayout());
  });

  it('returns the default layout when sections is not an array', () => {
    expect(reconcileHomeLayout(JSON.stringify({ v: 1, sections: 'nope' }))).toEqual(
      defaultHomeLayout(),
    );
  });

  it('round-trips a stored non-default order', () => {
    const custom: HomeSectionEntry[] = [
      { id: 'at-risk', visible: true },
      { id: 'review-cta', visible: true },
      { id: 'lesson-cta', visible: true },
      { id: 'goal-ring', visible: false },
      { id: 'level-progress', visible: true },
      { id: 'review-forecast', visible: false },
      { id: 'reading-readiness', visible: true },
    ];

    expect(reconcileHomeLayout(serializeHomeLayout(custom))).toEqual(custom);
  });

  it('drops stored ids that are not in the catalog', () => {
    const stored = JSON.stringify({
      v: 1,
      sections: [...DEFAULT_ORDER.map((id) => ({ id, visible: true })), { id: 'ghost-section', visible: true }],
    });

    expect(ids(reconcileHomeLayout(stored))).toEqual(DEFAULT_ORDER);
  });

  it('drops malformed and duplicate entries', () => {
    const stored = JSON.stringify({
      v: 1,
      sections: [
        { id: 'at-risk', visible: true },
        null,
        { visible: true },
        { id: 'at-risk', visible: false },
      ],
    });

    const layout = reconcileHomeLayout(stored);
    expect(layout.filter((entry) => entry.id === 'at-risk')).toHaveLength(1);
    expect(ids(layout)).toHaveLength(HOME_SECTION_CATALOG.length);
  });

  it('appends a catalog section missing from the stored list at its default position', () => {
    // A layout saved before `level-progress` (default index 3) existed.
    const stored = JSON.stringify({
      v: 1,
      sections: DEFAULT_ORDER.filter((id) => id !== 'level-progress').map((id) => ({
        id,
        visible: true,
      })),
    });

    expect(ids(reconcileHomeLayout(stored))).toEqual(DEFAULT_ORDER);
  });

  it('slots missing sections next to their default neighbours in a shuffled layout', () => {
    const stored = JSON.stringify({
      v: 1,
      sections: [
        { id: 'at-risk', visible: true },
        { id: 'review-cta', visible: true },
        { id: 'lesson-cta', visible: true },
      ],
    });

    // The learner's own order (at-risk first) survives; each missing section
    // lands after the last stored section that precedes it by default.
    expect(ids(reconcileHomeLayout(stored))).toEqual([
      'goal-ring',
      'at-risk',
      'review-cta',
      'lesson-cta',
      'level-progress',
      'review-forecast',
      'reading-readiness',
    ]);
  });

  it('forces required sections visible when stored as hidden', () => {
    const stored = JSON.stringify({
      v: 1,
      sections: DEFAULT_ORDER.map((id) => ({ id, visible: false })),
    });

    const layout = reconcileHomeLayout(stored);
    expect(layout.find((entry) => entry.id === 'review-cta')?.visible).toBe(true);
    expect(layout.find((entry) => entry.id === 'lesson-cta')?.visible).toBe(true);
    expect(layout.find((entry) => entry.id === 'goal-ring')?.visible).toBe(false);
  });

  it('restores required sections dropped from the stored list', () => {
    const stored = JSON.stringify({
      v: 1,
      sections: [{ id: 'at-risk', visible: true }],
    });

    const layout = reconcileHomeLayout(stored);
    expect(ids(layout)).toContain('review-cta');
    expect(ids(layout)).toContain('lesson-cta');
    expect(layout.find((entry) => entry.id === 'review-cta')?.visible).toBe(true);
  });

  it('treats a missing visible flag as visible', () => {
    const stored = JSON.stringify({ v: 1, sections: [{ id: 'goal-ring' }] });

    expect(reconcileHomeLayout(stored).find((entry) => entry.id === 'goal-ring')?.visible).toBe(
      true,
    );
  });
});
