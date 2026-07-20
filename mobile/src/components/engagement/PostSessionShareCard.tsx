import { Text, View } from 'react-native';

import type { DomainCounts } from '@/utils/timeFormat';

type PostSessionShareCardProps = {
  domainCounts: DomainCounts;
  actualMinutes: number;
  /** Multi-app estimate (FR33b) — pass only when it beats actualMinutes. */
  estimatedMinutes?: number | null;
  /** Goal state line, e.g. "Goal met — +20% overshoot"; never a streak. */
  goalLine?: string | null;
  sessionDate?: Date;
};

function formatSessionDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PostSessionShareCard({
  domainCounts,
  actualMinutes,
  estimatedMinutes = null,
  goalLine = null,
  sessionDate = new Date(),
}: PostSessionShareCardProps) {
  const domainParts: string[] = [];
  if (domainCounts.kanji > 0) domainParts.push(`Kanji ${domainCounts.kanji}`);
  if (domainCounts.grammar > 0) domainParts.push(`Grammar ${domainCounts.grammar}`);
  if (domainCounts.vocabulary > 0) domainParts.push(`Vocab ${domainCounts.vocabulary}`);
  if (domainCounts.radical > 0) domainParts.push(`Radical ${domainCounts.radical}`);

  return (
    <View
      testID="post-session-share-card"
      className="rounded-radius-lg border-2 border-border bg-surface-elevated p-space-lg">
      <Text className="text-title-lg font-semibold text-primary">Japanese Learning</Text>
      <Text className="mt-space-xs text-caption text-secondary">{formatSessionDate(sessionDate)}</Text>

      <Text className="mt-space-md text-body text-primary">{domainParts.join(' · ') || 'No items reviewed'}</Text>
      <Text className="mt-space-sm text-body-lg font-semibold text-primary">{`${actualMinutes} min studied`}</Text>
      {estimatedMinutes !== null ? (
        <Text className="mt-space-xs text-body text-secondary">{`~${estimatedMinutes} min in separate apps`}</Text>
      ) : null}
      {goalLine !== null ? (
        <Text className="mt-space-xs text-body text-secondary">{goalLine}</Text>
      ) : null}
    </View>
  );
}

export function buildShareMessage(props: PostSessionShareCardProps): string {
  const { domainCounts, actualMinutes, estimatedMinutes = null, goalLine = null } = props;
  const parts: string[] = [];

  if (domainCounts.kanji > 0) parts.push(`Kanji: ${domainCounts.kanji}`);
  if (domainCounts.grammar > 0) parts.push(`Grammar: ${domainCounts.grammar}`);
  if (domainCounts.vocabulary > 0) parts.push(`Vocab: ${domainCounts.vocabulary}`);
  if (domainCounts.radical > 0) parts.push(`Radical: ${domainCounts.radical}`);

  const domainLine = parts.length > 0 ? parts.join(', ') : 'No items reviewed';
  const timeLine =
    estimatedMinutes !== null
      ? `${actualMinutes} min studied (~${estimatedMinutes} min in separate apps)`
      : `${actualMinutes} min studied`;

  const lines = [`Japanese Learning session complete!`, domainLine, timeLine];
  if (goalLine !== null) lines.push(goalLine);
  return lines.join('\n');
}
