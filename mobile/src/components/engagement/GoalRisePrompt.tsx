import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';

type GoalRisePromptProps = {
  /** Proposed higher daily goal in load units. */
  proposedGoal: number;
  currentGoal: number;
  /** Writes the new target and clears the pending offer. */
  onAccept: () => void;
  /** Opens Settings to fine-tune the goal instead. */
  onAdjust: () => void;
  /** Hides the prompt for now; the offer stays pending until answered. */
  onDismiss: () => void;
};

/**
 * Congratulatory goal-rise offer (FR57, UX-DR28). Shown on Home only — never
 * inside a review session. The goal is never raised without the user's say-so.
 */
export function GoalRisePrompt({
  proposedGoal,
  currentGoal,
  onAccept,
  onAdjust,
  onDismiss,
}: GoalRisePromptProps) {
  return (
    <View
      testID="goal-rise-prompt"
      accessibilityLabel={`You beat your goal last week. Raise your daily goal from ${currentGoal} to ${proposedGoal}?`}
      className="rounded-radius-lg border border-ring-complete bg-surface p-space-md">
      <Text className="text-body-lg font-semibold text-primary">
        You&apos;re outpacing your goal 🎉
      </Text>
      <Text className="mt-space-xs text-body-sm text-secondary">
        Last week you averaged more than your daily goal of {currentGoal}. Want to raise it to{' '}
        {proposedGoal}?
      </Text>
      <View className="mt-space-md flex-row gap-space-sm">
        <Button
          label={`Raise to ${proposedGoal}`}
          onPress={onAccept}
          testID="goal-rise-accept"
          className="flex-1"
        />
        <Button
          label="Adjust"
          variant="secondary"
          onPress={onAdjust}
          testID="goal-rise-adjust"
        />
        <Button
          label="Not now"
          variant="secondary"
          onPress={onDismiss}
          testID="goal-rise-dismiss"
        />
      </View>
    </View>
  );
}

type GoalReductionPromptProps = {
  /** Offered lower daily goal in load units. */
  proposedGoal: number;
  currentGoal: number;
  /** Lowers the target and clears the offer. */
  onAccept: () => void;
  /** Declines: clears the offer and resets the miss counter. */
  onDecline: () => void;
};

/**
 * Opt-in reduction offer after sustained miss weeks (FR57). Kindness framing —
 * the goal never drops unless the user accepts.
 */
export function GoalReductionPrompt({
  proposedGoal,
  currentGoal,
  onAccept,
  onDecline,
}: GoalReductionPromptProps) {
  return (
    <View
      testID="goal-reduction-prompt"
      accessibilityLabel={`Been a tough stretch? You could lower your daily goal from ${currentGoal} to ${proposedGoal}.`}
      className="rounded-radius-lg border border-border bg-surface p-space-md">
      <Text className="text-body-lg font-semibold text-primary">Been a tough stretch?</Text>
      <Text className="mt-space-xs text-body-sm text-secondary">
        Your goal of {currentGoal} has been out of reach lately. A goal of {proposedGoal} would
        match your recent pace — want to ease off? You can raise it again anytime.
      </Text>
      <View className="mt-space-md flex-row gap-space-sm">
        <Button
          label={`Lower to ${proposedGoal}`}
          onPress={onAccept}
          testID="goal-reduction-accept"
          className="flex-1"
        />
        <Button
          label="Keep my goal"
          variant="secondary"
          onPress={onDecline}
          testID="goal-reduction-decline"
        />
      </View>
    </View>
  );
}
