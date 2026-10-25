import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { StudyStatusControl } from '@/components/learn/StudyStatusControl';
import { setStudyStatus } from '@/data/user/itemStudyStatusRepository';
import { getSrsState } from '@/data/user/srsStateRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

jest.mock('@/data/hooks/useDatabase', () => {
  // Stable object: an unstable identity would re-fire db-keyed memos every render.
  const databases = { userDb: {}, curriculumDb: {} };
  return { useDatabase: () => databases };
});

let mockReadOnceIds = new Set<string>();
jest.mock('@/data/curriculum/itemRepository', () => ({
  listReadOnceGrammarIds: () => mockReadOnceIds,
}));

let mockStatus: StudyStatus = 'known';
jest.mock('@/data/hooks/useItemStudyStatus', () => ({
  useItemStudyStatus: () => mockStatus,
}));

jest.mock('@/data/user/itemStudyStatusRepository', () => ({
  setStudyStatus: jest.fn(),
}));

jest.mock('@/data/user/srsStateRepository', () => ({
  getSrsState: jest.fn(() => null),
}));

describe('StudyStatusControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = 'known';
    mockReadOnceIds = new Set();
    jest.mocked(getSrsState).mockReturnValue(null);
  });

  it('shows the recorded status as the selected segment', () => {
    render(<StudyStatusControl itemId="42" />);

    expect(screen.getByTestId('study-status-set-known').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByText('Kept out of your lessons and reviews.')).toBeTruthy();
  });

  it('offers a read-once card no In progress option, since it is never reviewed', () => {
    mockReadOnceIds = new Set(['42']);
    render(<StudyStatusControl itemId="42" />);

    expect(screen.queryByTestId('study-status-set-in_progress')).toBeNull();
    expect(screen.getByTestId('study-status-set-known')).toBeTruthy();
    expect(screen.getByTestId('study-status-set-not_started')).toBeTruthy();
  });

  it('still offers In progress for an ordinary item', () => {
    render(<StudyStatusControl itemId="42" />);

    expect(screen.getByTestId('study-status-set-in_progress')).toBeTruthy();
  });

  it('returns an over-estimated item to the lesson pool', () => {
    render(<StudyStatusControl itemId="42" />);

    fireEvent.press(screen.getByTestId('study-status-set-not_started'));

    expect(jest.mocked(setStudyStatus)).toHaveBeenCalledWith({}, '42', 'not_started');
    // The status hook is a plain memo over the db and does not re-run after the
    // write, so the new selection has to come from local state.
    expect(screen.getByText('Waiting in your lessons.')).toBeTruthy();
  });

  it('drops an already-known item straight into reviews', () => {
    mockStatus = 'not_started';
    render(<StudyStatusControl itemId="42" />);

    fireEvent.press(screen.getByTestId('study-status-set-in_progress'));

    expect(jest.mocked(setStudyStatus)).toHaveBeenCalledWith({}, '42', 'in_progress');
    expect(screen.getByText('In your reviews, on the normal schedule.')).toBeTruthy();
  });

  it('says the review history survives a reset for a studied item', () => {
    mockStatus = 'in_progress';
    jest.mocked(getSrsState).mockReturnValue({ itemId: '42', isBurned: false } as never);
    render(<StudyStatusControl itemId="42" />);

    fireEvent.press(screen.getByTestId('study-status-set-not_started'));

    expect(screen.getByText(/its review history is kept/)).toBeTruthy();
  });

  it('disables the pill for a burned item instead of offering a no-op', () => {
    // queueBuilder drops burned items whatever their status, so no setting here
    // could put this item back into reviews.
    jest.mocked(getSrsState).mockReturnValue({ itemId: '42', isBurned: true } as never);
    render(<StudyStatusControl itemId="42" />);

    fireEvent.press(screen.getByTestId('study-status-set-not_started'));

    expect(jest.mocked(setStudyStatus)).not.toHaveBeenCalled();
    expect(screen.getByText(/stays out of reviews for good/)).toBeTruthy();
  });
});
