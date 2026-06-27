import type { CurriculumParentItem } from '@/data/curriculum/itemRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

import { getUnmetPrerequisites, isItemUnlocked } from './dependencyGraph';

const radical: CurriculumParentItem = {
  id: '1',
  primaryForm: '日',
  itemType: 'radical',
};

const kanji: CurriculumParentItem = {
  id: '2',
  primaryForm: '食',
  itemType: 'kanji',
};

function statusMap(entries: Record<string, StudyStatus>): Map<string, StudyStatus> {
  return new Map(Object.entries(entries));
}

describe('isItemUnlocked', () => {
  it('returns true when there are no parents', () => {
    expect(isItemUnlocked([], new Map())).toBe(true);
  });

  it('returns true when all parents are known', () => {
    expect(isItemUnlocked([radical, kanji], statusMap({ '1': 'known', '2': 'known' }))).toBe(true);
  });

  it('returns true when all parents are in_progress', () => {
    expect(
      isItemUnlocked([radical, kanji], statusMap({ '1': 'in_progress', '2': 'in_progress' })),
    ).toBe(true);
  });

  it('returns true when parents are mixed known and in_progress', () => {
    expect(
      isItemUnlocked([radical, kanji], statusMap({ '1': 'known', '2': 'in_progress' })),
    ).toBe(true);
  });

  it('returns false when any parent is not_started', () => {
    expect(isItemUnlocked([radical], statusMap({}))).toBe(false);
  });

  it('returns false when one parent is not_started among met parents', () => {
    expect(
      isItemUnlocked([radical, kanji], statusMap({ '1': 'known', '2': 'not_started' })),
    ).toBe(false);
  });
});

describe('getUnmetPrerequisites', () => {
  it('returns empty array when there are no parents', () => {
    expect(getUnmetPrerequisites([], new Map())).toEqual([]);
  });

  it('returns empty array when all parents are known or in_progress', () => {
    expect(
      getUnmetPrerequisites([radical, kanji], statusMap({ '1': 'known', '2': 'in_progress' })),
    ).toEqual([]);
  });

  it('returns only not_started parents', () => {
    expect(
      getUnmetPrerequisites([radical, kanji], statusMap({ '1': 'known' })),
    ).toEqual([kanji]);
  });

  it('returns all parents when none have status rows', () => {
    expect(getUnmetPrerequisites([radical, kanji], new Map())).toEqual([radical, kanji]);
  });
});
