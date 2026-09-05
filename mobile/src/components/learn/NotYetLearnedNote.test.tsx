import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { NotYetLearnedNote } from '@/components/learn/NotYetLearnedNote';
import type { LessonOptInOffer } from '@/data/hooks/useLessonOptIn';

let mockOffers = new Map<string, LessonOptInOffer>();
const mockToggle = jest.fn();

jest.mock('@/data/hooks/useLessonOptIn', () => ({
  useLessonOptIn: () => ({ offers: mockOffers, toggle: mockToggle }),
}));

/** N5's 昨日 with 昨 (N3) unlearned. */
const kinou = [{ id: '2552', primaryForm: '昨' }];

describe('NotYetLearnedNote', () => {
  beforeEach(() => {
    mockOffers = new Map();
    mockToggle.mockClear();
  });

  it('names the character and prices the opt-in on the button', () => {
    mockOffers = new Map([['2552', { itemId: '2552', extraItemCount: 2, isOptedIn: false }]]);

    render(<NotYetLearnedNote items={kinou} testID="note" />);

    expect(
      screen.getByText("You haven't learned 昨 yet — it comes later in the course."),
    ).toBeTruthy();
    // The count is never silent: the learner has already tuned their goal ring.
    expect(screen.getByTestId('note-opt-in-2552').props.accessibilityLabel).toBe(
      'Learn 昨 now (+2 items)',
    );
  });

  it('says "item" for a closure of one', () => {
    mockOffers = new Map([['2552', { itemId: '2552', extraItemCount: 1, isOptedIn: false }]]);

    render(<NotYetLearnedNote items={kinou} testID="note" />);

    expect(screen.getByTestId('note-opt-in-2552').props.accessibilityLabel).toBe(
      'Learn 昨 now (+1 item)',
    );
  });

  it('offers to undo an opt-in already taken', () => {
    mockOffers = new Map([['2552', { itemId: '2552', extraItemCount: 2, isOptedIn: true }]]);

    render(<NotYetLearnedNote items={kinou} testID="note" />);

    expect(screen.getByTestId('note-opt-in-2552').props.accessibilityLabel).toBe(
      '昨 added to your lessons — tap to remove',
    );
  });

  it('toggles the item it was pressed for', () => {
    mockOffers = new Map([['2552', { itemId: '2552', extraItemCount: 2, isOptedIn: false }]]);

    render(<NotYetLearnedNote items={kinou} testID="note" />);
    fireEvent.press(screen.getByTestId('note-opt-in-2552'));

    expect(mockToggle).toHaveBeenCalledWith('2552');
  });

  it('still says which characters are unlearned when there is nothing to opt into', () => {
    render(
      <NotYetLearnedNote
        items={[
          { id: '2552', primaryForm: '昨' },
          { id: '1091', primaryForm: '乍' },
        ]}
        testID="note"
      />,
    );

    expect(
      screen.getByText("You haven't learned 昨、乍 yet — they come later in the course."),
    ).toBeTruthy();
    expect(screen.queryByTestId('note-opt-in-2552')).toBeNull();
  });
});
