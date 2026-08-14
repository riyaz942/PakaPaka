export type HomeSectionId =
  | 'goal-ring'
  | 'review-cta'
  | 'lesson-cta'
  | 'level-progress'
  | 'review-forecast'
  | 'reading-readiness'
  | 'at-risk';

export type HomeSectionEntry = {
  id: HomeSectionId;
  visible: boolean;
};

export type HomeSectionDefinition = {
  id: HomeSectionId;
  /** Required sections can be reordered but never hidden. */
  required: boolean;
};

/** Catalog order is the default Home order — the layout every learner starts on. */
export const HOME_SECTION_CATALOG: readonly HomeSectionDefinition[] = [
  { id: 'goal-ring', required: false },
  { id: 'review-cta', required: true },
  { id: 'lesson-cta', required: true },
  { id: 'level-progress', required: false },
  { id: 'review-forecast', required: false },
  { id: 'reading-readiness', required: false },
  { id: 'at-risk', required: false },
];

export const HOME_LAYOUT_VERSION = 1;

export function isRequiredHomeSection(id: HomeSectionId): boolean {
  return HOME_SECTION_CATALOG.some((section) => section.id === id && section.required);
}

export function defaultHomeLayout(): HomeSectionEntry[] {
  return HOME_SECTION_CATALOG.map((section) => ({ id: section.id, visible: true }));
}

export function serializeHomeLayout(entries: HomeSectionEntry[]): string {
  return JSON.stringify({ v: HOME_LAYOUT_VERSION, sections: entries });
}

/**
 * Turns whatever is stored (or nothing at all) into a layout Home can render.
 *
 * A missing or corrupt value yields the default order — that is the documented
 * starting state, not a degraded one: a learner who has never opened the
 * customizer has no stored layout, and the default order is exactly the Home
 * they already see.
 *
 * The "catalog id missing from the stored list is appended at its default-order
 * position" rule is what lets a future version add a Home section without it
 * silently vanishing for everyone who has already customized their layout.
 */
export function reconcileHomeLayout(stored: string | null): HomeSectionEntry[] {
  const entries = parseStoredEntries(stored);
  if (entries === null) {
    return defaultHomeLayout();
  }

  const reconciled = entries;
  HOME_SECTION_CATALOG.forEach((section, defaultIndex) => {
    if (reconciled.some((entry) => entry.id === section.id)) {
      return;
    }
    // Slot it in after the last section that precedes it in the default order,
    // so a newly added section lands next to its default neighbours rather than
    // at a fixed index the learner's own arrangement has moved past.
    let insertAt = 0;
    reconciled.forEach((entry, index) => {
      if (defaultIndexOf(entry.id) < defaultIndex) {
        insertAt = index + 1;
      }
    });
    reconciled.splice(insertAt, 0, { id: section.id, visible: true });
  });

  return reconciled.map((entry) =>
    isRequiredHomeSection(entry.id) ? { id: entry.id, visible: true } : entry,
  );
}

/** Null means "unusable" — no value, bad JSON, or a version this build predates. */
function parseStoredEntries(stored: string | null): HomeSectionEntry[] | null {
  if (stored === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const record = parsed as { v?: unknown; sections?: unknown };
  if (record.v !== HOME_LAYOUT_VERSION || !Array.isArray(record.sections)) {
    return null;
  }

  const seen = new Set<HomeSectionId>();
  const entries: HomeSectionEntry[] = [];
  for (const raw of record.sections) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { id, visible } = raw as { id?: unknown; visible?: unknown };
    if (typeof id !== 'string' || !isHomeSectionId(id) || seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, visible: visible !== false });
  }
  return entries;
}

function defaultIndexOf(id: HomeSectionId): number {
  return HOME_SECTION_CATALOG.findIndex((section) => section.id === id);
}

function isHomeSectionId(value: string): value is HomeSectionId {
  return HOME_SECTION_CATALOG.some((section) => section.id === value);
}
