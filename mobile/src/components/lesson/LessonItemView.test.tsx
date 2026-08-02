import { render, screen } from '@testing-library/react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import React from 'react';

import {
  __mockResetSqlite,
  __mockSetItemRelationships,
  __mockSetItems,
  __mockSetKanjiReadings,
} from '../../../__mocks__/expo-sqlite';

import { LessonItemView } from '@/components/lesson/LessonItemView';
import { __resetKanjiReadingPrimerSessionForTests } from '@/data/hooks/useKanjiReadingPrimer';
import { migration001Initial } from '@/data/migrations/001_initial';
import { migration002ItemStudyStatus } from '@/data/migrations/002_item_study_status';
import { runMigrations } from '@/data/migrations/migrationRunner';
import { setOnboardingPath } from '@/data/user/preferencesRepository';
import { DatabaseContext, type DatabaseContextValue } from '@/providers/DatabaseContext';

// Radical art is bundled, so the real map only contains committed files. These
// tests exercise layout, not asset resolution: treat any ref as drawn.
jest.mock('@/utils/radicalImages', () => ({
  getRadicalImage: (ref?: string | null) => (ref ? 1 : undefined),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      const cleanup = callback();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [callback]);
  },
}));

async function createDatabases() {
  const curriculumDb = await openDatabaseAsync('curriculum.db.test');
  const userDb = await openDatabaseAsync('user.db');
  const result = runMigrations(userDb, [migration001Initial, migration002ItemStudyStatus]);
  expect(result.ok).toBe(true);

  __mockSetItems('curriculum.db.test', [
    {
      id: 1,
      item_type: 'radical',
      jlpt_level: 'N5',
      slug: 'sun',
      primary_form: '一',
      meaning: 'one',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 1,
    },
    {
      id: 2,
      item_type: 'kanji',
      jlpt_level: 'N5',
      slug: 'day',
      primary_form: '日',
      meaning: 'day',
      mnemonic_text: 'The sun rises each day.',
      visual_mnemonic_url: null,
      sort_order: 1,
    },
    {
      id: 3,
      item_type: 'vocabulary',
      jlpt_level: 'N5',
      slug: 'mainichi',
      primary_form: '毎日',
      meaning: 'every day',
      mnemonic_text: null,
      visual_mnemonic_url: null,
      sort_order: 1,
    },
  ]);

  __mockSetKanjiReadings('curriculum.db.test', [
    { id: 1, item_id: 2, reading_type: 'onyomi', reading: 'ニチ', sort_order: 1 },
    { id: 2, item_id: 2, reading_type: 'kunyomi', reading: 'ひ', sort_order: 2 },
  ]);

  __mockSetItemRelationships('curriculum.db.test', [
    { parent_item_id: 1, child_item_id: 2, relationship_type: 'builds_on' },
    { parent_item_id: 2, child_item_id: 3, relationship_type: 'requires' },
  ]);

  return { curriculumDb, userDb };
}

function mount(
  curriculumDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  userDb: Awaited<ReturnType<typeof openDatabaseAsync>>,
  sectionIndex: number,
) {
  const contextValue = {
    curriculumDb,
    userDb,
    isReady: true,
    error: null,
  } as unknown as DatabaseContextValue;

  return render(
    <DatabaseContext.Provider value={contextValue}>
      <LessonItemView itemId="2" sectionIndex={sectionIndex} />
    </DatabaseContext.Provider>,
  );
}

describe('LessonItemView sections', () => {
  beforeEach(() => {
    __mockResetSqlite();
    __resetKanjiReadingPrimerSessionForTests();
  });

  it('section 1 introduces the item without examples or links', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    mount(curriculumDb, userDb, 0);

    expect(screen.getByTestId('lesson-section-intro')).toBeTruthy();
    expect(screen.getByText('日')).toBeTruthy();
    expect(screen.getByText('day')).toBeTruthy();
    // Readings moved to the Mnemonic section, next to the reading mnemonic.
    expect(screen.queryByText('ニチ')).toBeNull();
    expect(screen.queryByTestId('lesson-section-examples')).toBeNull();
    expect(screen.queryByTestId('item-cross-references')).toBeNull();
  });

  it('section 2 carries the mnemonics', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    mount(curriculumDb, userDb, 1);

    expect(screen.getByTestId('lesson-section-mnemonic')).toBeTruthy();
    expect(screen.getByText('The sun rises each day.')).toBeTruthy();
    expect(screen.getByTestId('personal-mnemonic-editor')).toBeTruthy();
    // Paging replaced the collapsed mnemonic — nothing hides behind a tap.
    expect(screen.queryByTestId('mnemonic-disclosure')).toBeNull();
  });

  it('section 3 carries examples and cross-references', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    mount(curriculumDb, userDb, 2);

    expect(screen.getByTestId('lesson-section-examples')).toBeTruthy();
    expect(screen.getByText('Built from')).toBeTruthy();
    expect(screen.getByTestId('cross-ref-components-1')).toBeTruthy();
    expect(screen.getByText('Vocabulary using this kanji')).toBeTruthy();
    expect(screen.getByTestId('cross-ref-related-3')).toBeTruthy();
  });

  function setRev1Kanji() {
    __mockSetItems('curriculum.db.test', [
      {
        id: 1,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'sun',
        primary_form: '一',
        meaning: 'one',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: 'The sun rises each day.',
        meaning_mnemonic: 'One flat horizon with the sun pinned to it: a day.',
        reading_mnemonic: 'ニチ — the sun knocks twice and says nichi.',
        description: 'Also means sun. Do not confuse it with 目.',
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);
  }

  it('section 1 puts the description directly under the hero', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    setRev1Kanji();

    mount(curriculumDb, userDb, 0);

    expect(screen.getByTestId('item-description')).toBeTruthy();
    expect(screen.getByText('Also means sun. Do not confuse it with 目.')).toBeTruthy();
  });

  it('section 2 renders the Rev 1 split mnemonics and composition line, without the description', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    setRev1Kanji();

    mount(curriculumDb, userDb, 1);

    expect(screen.getByText('一 = 日')).toBeTruthy();
    expect(screen.getByText('One flat horizon with the sun pinned to it: a day.')).toBeTruthy();
    expect(screen.getByText('ニチ — the sun knocks twice and says nichi.')).toBeTruthy();
    expect(screen.queryByTestId('item-description')).toBeNull();
    expect(screen.queryByText('The sun rises each day.')).toBeNull();
  });

  it('section 2 slots the kanji readings between the meaning and reading mnemonics', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    setRev1Kanji();

    mount(curriculumDb, userDb, 1);

    expect(screen.getByTestId('lesson-kanji-readings')).toBeTruthy();
    expect(screen.getByText('ニチ')).toBeTruthy();
    expect(screen.getByText('ひ')).toBeTruthy();

    const tree = JSON.stringify(screen.toJSON());
    const meaningMnemonic = tree.indexOf('One flat horizon');
    const readings = tree.indexOf('ニチ"');
    const readingMnemonic = tree.indexOf('ニチ — the sun knocks twice');
    expect(meaningMnemonic).toBeLessThan(readings);
    expect(readings).toBeLessThan(readingMnemonic);
  });

  it('section 2 still shows the kanji readings when the item has no mnemonic', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    __mockSetItems('curriculum.db.test', [
      {
        id: 2,
        item_type: 'kanji',
        jlpt_level: 'N5',
        slug: 'day',
        primary_form: '日',
        meaning: 'day',
        mnemonic_text: null,
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    mount(curriculumDb, userDb, 1);

    expect(screen.getByTestId('lesson-mnemonic-empty')).toBeTruthy();
    expect(screen.getByText('ニチ')).toBeTruthy();
  });

  it('section 2 captions a radical with its mnemonic and keeps the description separate', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    __mockSetItems('curriculum.db.test', [
      {
        id: 2,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'person',
        primary_form: '人',
        meaning: 'person',
        mnemonic_text: 'Two legs mid-stride and no head at all: a person.',
        description: 'Not to be confused with 入, whose left stroke starts lower.',
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    mount(curriculumDb, userDb, 1);

    // The story renders exactly once — the image (and its text fallback, which
    // repeated the story) is no longer on this section.
    expect(screen.getByTestId('radical-description')).toBeTruthy();
    expect(screen.queryByTestId('radical-mnemonic-image')).toBeNull();
    expect(screen.getAllByText('Two legs mid-stride and no head at all: a person.')).toHaveLength(
      1,
    );
    expect(screen.getByText('About this radical')).toBeTruthy();
    expect(
      screen.getByText('Not to be confused with 入, whose left stroke starts lower.'),
    ).toBeTruthy();
  });

  it('section 2 shows the radical story, then the illustration it belongs to', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    __mockSetItems('curriculum.db.test', [
      {
        id: 2,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'person',
        primary_form: '人',
        meaning: 'person',
        mnemonic_text: 'Two legs mid-stride and no head at all: a person.',
        visual_mnemonic_url: 'radicals/n5/person.webp',
        sort_order: 1,
      },
    ]);

    mount(curriculumDb, userDb, 1);

    expect(screen.getByTestId('radical-mnemonic-image')).toBeTruthy();
    expect(screen.queryByTestId('lesson-mnemonic-image-placeholder')).toBeNull();

    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Two legs mid-stride')).toBeLessThan(
      tree.indexOf('radical-mnemonic-image'),
    );
  });

  it('keeps the illustration slot as a placeholder when the radical has no image', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    __mockSetItems('curriculum.db.test', [
      {
        id: 2,
        item_type: 'radical',
        jlpt_level: 'N5',
        slug: 'person',
        primary_form: '人',
        meaning: 'person',
        mnemonic_text: 'Two legs mid-stride and no head at all: a person.',
        visual_mnemonic_url: null,
        sort_order: 1,
      },
    ]);

    mount(curriculumDb, userDb, 1);

    expect(screen.queryByTestId('radical-mnemonic-image')).toBeNull();
    expect(screen.getByTestId('lesson-mnemonic-image-placeholder')).toBeTruthy();
  });

  it('gives non-radical items no illustration slot at all', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    mount(curriculumDb, userDb, 1);

    expect(screen.queryByTestId('lesson-mnemonic-image-placeholder')).toBeNull();
    expect(screen.queryByTestId('radical-mnemonic-image')).toBeNull();
  });

  it('keeps the stepper and the hero on screen through every section', async () => {
    const { curriculumDb, userDb } = await createDatabases();

    for (const sectionIndex of [0, 1, 2]) {
      mount(curriculumDb, userDb, sectionIndex);

      expect(screen.getByTestId('lesson-section-stepper')).toBeTruthy();
      expect(screen.getAllByText('日').length).toBeGreaterThan(0);
      screen.unmount();
    }
  });

  it('shows the reading primer with the readings in section 2 for a beginner', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    setOnboardingPath(userDb, 'beginner');
    mount(curriculumDb, userDb, 1);

    // Inline beside the readings it explains, not a wall in front of the lesson.
    expect(screen.getByTestId('kanji-reading-primer')).toBeTruthy();
    expect(screen.getByTestId('lesson-kanji-readings')).toBeTruthy();
  });

  it('does not show the primer unprompted on the manual path', async () => {
    const { curriculumDb, userDb } = await createDatabases();
    setOnboardingPath(userDb, 'manual');
    mount(curriculumDb, userDb, 1);

    expect(screen.queryByTestId('kanji-reading-primer')).toBeNull();
    // The same explainer is still reachable from the readings heading.
    expect(screen.getByTestId("section-heading-info-on'yomi")).toBeTruthy();
  });
});
