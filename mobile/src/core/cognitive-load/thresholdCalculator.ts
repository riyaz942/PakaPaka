type DailyGoalTargetInput = {
  /** Today's lesson allowance total (after backlog throttling). */
  lessonAllowanceTotal: number;
  /** Everything counted toward the ring today (lessons + answered reviews). */
  todayLoad: number;
  /** Lesson items started today. */
  lessonItemsToday: number;
  /** Reviews still due now. */
  reviewsDueCount: number;
};

/**
 * The ring's denominator: today's lessons plus today's reviews. Reviews are
 * the ones already answered today plus the ones still due, so the target
 * stays put while you work through a session. Lessons past the allowance
 * ("Learn anyway") are overshoot, not a bigger target.
 */
export function computeDailyGoalTarget(input: DailyGoalTargetInput): number {
  const reviewsDoneToday = Math.max(0, input.todayLoad - input.lessonItemsToday);
  return Math.max(1, input.lessonAllowanceTotal + reviewsDoneToday + input.reviewsDueCount);
}
