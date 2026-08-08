import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { SegmentedPill, type SegmentedPillOption } from '@/components/common/SegmentedPill';
import { useDatabase } from '@/data/hooks/useDatabase';
import { useItemStudyStatus } from '@/data/hooks/useItemStudyStatus';
import { setStudyStatus } from '@/data/user/itemStudyStatusRepository';
import { getSrsState } from '@/data/user/srsStateRepository';
import type { StudyStatus } from '@/data/user/studyStatus.types';

/** Same wording as the Browse Performance facet, so setting and filtering agree. */
const STATUS_OPTIONS: readonly SegmentedPillOption<StudyStatus>[] = [
  { value: 'not_started', label: 'Not started', testID: 'study-status-set-not_started' },
  { value: 'in_progress', label: 'In progress', testID: 'study-status-set-in_progress' },
  { value: 'known', label: 'Known', testID: 'study-status-set-known' },
];

/** What the chosen status actually does, so the pill is never a silent no-op. */
function statusHint(status: StudyStatus, hasSrsState: boolean): string {
  if (status === 'known') {
    return 'Kept out of your lessons and reviews.';
  }
  if (status === 'in_progress') {
    return 'In your reviews, on the normal schedule.';
  }
  return hasSrsState
    ? 'Waiting in your lessons again — its review history is kept.'
    : 'Waiting in your lessons.';
}

/**
 * Self-report control for one item's study status (FR23).
 *
 * The placement self-check and the import path both bulk-write `known` from an
 * estimate, and that status removes an item from lessons (`lessonPlanner`), from
 * the review queue (`queueBuilder`) and from the due counts
 * (`reviewEligibility`). Nothing else wrote a status back, so an over-confident
 * estimate used to be a permanent, invisible exclusion. Setting `in_progress`
 * works the other way: the queue seeds a missing SRS state for in-progress items,
 * so an item the learner already knows can be dropped straight into reviews
 * without sitting through its lesson.
 *
 * Disabled once an item has burned: `queueBuilder` drops burned items whatever
 * their status, so the pill could not deliver what it offered there.
 */
export function StudyStatusControl({ itemId }: { itemId: string }) {
  const { userDb } = useDatabase();
  const recordedStatus = useItemStudyStatus(itemId);
  // Local: the status hook is a plain memo over the db and does not re-run after
  // the write below.
  const [chosenStatus, setChosenStatus] = useState<StudyStatus | null>(null);
  const status = chosenStatus ?? recordedStatus;

  const srsState = useMemo(() => getSrsState(userDb, itemId), [userDb, itemId]);

  return (
    <View
      className="mb-space-md rounded-radius-md border border-border bg-surface px-space-md py-space-sm"
      testID="study-status-control">
      <Text className="text-label font-ui-semibold text-primary">Your status</Text>

      <SegmentedPill
        options={STATUS_OPTIONS}
        value={status}
        onChange={(next) => {
          setStudyStatus(userDb, itemId, next);
          setChosenStatus(next);
        }}
        accessibilityLabel="Study status"
        disabled={srsState?.isBurned ?? false}
        expand
        className="mt-space-sm"
      />

      <Text
        className="mt-space-sm text-caption font-ui-medium text-muted"
        testID="study-status-control-hint">
        {srsState?.isBurned
          ? 'Burned — you finished this one, so it stays out of reviews for good.'
          : statusHint(status, srsState !== null)}
      </Text>
    </View>
  );
}
