import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import type { ConflictEntry } from '@/core/sync/sync.types';
import type { SyncContextValue } from '@/providers/SyncProvider';

import { SyncConflictDialog } from './SyncConflictDialog';

let mockSync: Pick<SyncContextValue, 'conflicts' | 'chooseConflict'>;
jest.mock('@/providers/SyncProvider', () => ({
  useSync: () => mockSync,
}));

const mockCurriculumDb = {};
jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ curriculumDb: mockCurriculumDb, userDb: {} }),
}));

jest.mock('@/data/curriculum/itemRepository', () => ({
  getItemBySlug: (_db: unknown, itemType: string, slug: string) =>
    itemType === 'kanji' && slug === 'mizu'
      ? { slug, itemType, primaryForm: '水', meaning: 'water' }
      : null,
}));

const WHEN = '2026-11-10T09:30:00.000Z';
const WHEN_TEXT = new Date(WHEN).toLocaleString();

function setup(conflicts: ConflictEntry[] | null) {
  mockSync = { conflicts, chooseConflict: jest.fn() };
  render(<SyncConflictDialog />);
}

describe('SyncConflictDialog', () => {
  it('hidden when conflicts is null', () => {
    setup(null);
    expect(screen.queryByTestId('sync-conflict-dialog')).toBeNull();
  });

  it('the exact title and body', () => {
    setup([{ kind: 'preference', key: 'x', localUpdatedAt: WHEN, remoteUpdatedAt: WHEN }]);
    expect(screen.getByText('Progress changed on two devices')).toBeTruthy();
    expect(
      screen.getByText(
        'These items changed on this device and on another device. Choose which version to keep. All other changes are already merged.',
      ),
    ).toBeTruthy();
  });

  it('lists an item entry with its characters and meaning', () => {
    setup([
      {
        kind: 'item',
        item: { itemType: 'kanji', slug: 'mizu' },
        localUpdatedAt: WHEN,
        remoteUpdatedAt: WHEN,
      },
    ]);
    expect(screen.getByTestId('sync-conflict-row-0')).toBeTruthy();
    expect(screen.getByText('水 · water')).toBeTruthy();
  });

  it('shows the slug when the item is not found', () => {
    setup([
      {
        kind: 'item',
        item: { itemType: 'vocabulary', slug: 'unknown-word' },
        localUpdatedAt: WHEN,
        remoteUpdatedAt: WHEN,
      },
    ]);
    expect(screen.getByText('unknown-word')).toBeTruthy();
  });

  it('lists a preference entry as "Setting: session intensity"', () => {
    setup([
      {
        kind: 'preference',
        key: 'session_intensity',
        localUpdatedAt: WHEN,
        remoteUpdatedAt: WHEN,
      },
    ]);
    expect(screen.getByText('Setting: session intensity')).toBeTruthy();
    expect(
      screen.getByText(`This device: ${WHEN_TEXT} · Other device: ${WHEN_TEXT}`),
    ).toBeTruthy();
  });

  it('shows "removed" for a side with no row', () => {
    setup([
      {
        kind: 'preference',
        key: 'session_intensity',
        localUpdatedAt: null,
        remoteUpdatedAt: WHEN,
      },
    ]);
    expect(screen.getByText(`This device: removed · Other device: ${WHEN_TEXT}`)).toBeTruthy();
  });

  it("Keep this device calls chooseConflict('local')", () => {
    setup([{ kind: 'preference', key: 'x', localUpdatedAt: WHEN, remoteUpdatedAt: WHEN }]);
    fireEvent.press(screen.getByLabelText('Keep this device'));
    expect(mockSync.chooseConflict).toHaveBeenCalledWith('local');
  });

  it("Use other device calls chooseConflict('remote')", () => {
    setup([{ kind: 'preference', key: 'x', localUpdatedAt: WHEN, remoteUpdatedAt: WHEN }]);
    fireEvent.press(screen.getByLabelText('Use other device'));
    expect(mockSync.chooseConflict).toHaveBeenCalledWith('remote');
  });
});
