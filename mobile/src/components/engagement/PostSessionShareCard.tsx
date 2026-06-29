import { Text, View } from 'react-native';

import type { DomainCounts } from '@/utils/timeFormat';

type PostSessionShareCardProps = {
  domainCounts: DomainCounts;
  actualMinutes: number;
  estimatedMinutes: number;
  hasSavings: boolean;
  currentStreak: number;
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
  estimatedMinutes,
  hasSavings,
  currentStreak,
  sessionDate = new Date(),
}: PostSessionShareCardProps) {
  const domainParts: string[] = [];
  if (domainCounts.kanji > 0) domainParts.push(`Kanji ${domainCounts.kanji}`);
  if (domainCounts.grammar > 0) domainParts.push(`Grammar ${domainCounts.grammar}`);
  if (domainCounts.vocabulary > 0) domainParts.push(`Vocab ${domainCounts.vocabulary}`);
  if (domainCounts.radical > 0) domainParts.push(`Radical ${domainCounts.radical}`);

  const compressionLine = hasSavings
    ? `${actualMinutes} min ≈ ~${estimatedMinutes} min across separate apps`
    : `${actualMinutes} min studied`;

  return (
    <View
      testID="post-session-share-card"
      className="rounded-radius-lg border-2 border-border bg-surface-elevated p-space-lg">
      <Text className="text-title-lg font-semibold text-primary">Japanese Learning</Text>
      <Text className="mt-space-xs text-caption text-secondary">{formatSessionDate(sessionDate)}</Text>

      <Text className="mt-space-md text-body text-primary">{domainParts.join(' · ') || 'No items reviewed'}</Text>
      <Text className="mt-space-sm text-body-lg font-semibold text-primary">{compressionLine}</Text>
      <Text className="mt-space-sm text-body text-secondary">{`${currentStreak} day streak`}</Text>
    </View>
  );
}

export function buildShareMessage(props: PostSessionShareCardProps): string {
  const { domainCounts, actualMinutes, estimatedMinutes, hasSavings, currentStreak } = props;
  const parts: string[] = [];

  if (domainCounts.kanji > 0) parts.push(`Kanji: ${domainCounts.kanji}`);
  if (domainCounts.grammar > 0) parts.push(`Grammar: ${domainCounts.grammar}`);
  if (domainCounts.vocabulary > 0) parts.push(`Vocab: ${domainCounts.vocabulary}`);
  if (domainCounts.radical > 0) parts.push(`Radical: ${domainCounts.radical}`);

  const domainLine = parts.length > 0 ? parts.join(', ') : 'No items reviewed';
  const timeLine = hasSavings
    ? `${actualMinutes} min studied (≈ ~${estimatedMinutes} min across separate apps)`
    : `${actualMinutes} min studied`;

  return `Japanese Learning session complete!\n${domainLine}\n${timeLine}\n${currentStreak} day streak`;
}
