import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { AnswerCollision } from '@/core/answer/answer.types';
import { deriveMeaningCandidates, normalizeMeaning } from '@/core/answer/meaningEvaluator';
import type { ReviewItem } from '@/core/srs/srs.types';
import type { ReviewRevealDetail } from '@/data/hooks/useReviewRevealDetails';

export type { AnswerCollision };

type AnswerRevealProps = {
  item: ReviewItem;
  /** Prefetched full detail; the reveal renders without it (thin fallback), never fetches */
  detail: ReviewRevealDetail | null;
  /** Set when the submitted answer belongs to a different item (FR86) */
  collision?: AnswerCollision | null;
};

/**
 * Alternates worth listing under the primary meaning: accepted meanings that
 * aren't just split-outs of the display string (those would be noise).
 */
function meaningAlternates(displayMeaning: string, meanings: string[]): string[] {
  const derived = new Set(deriveMeaningCandidates(displayMeaning).map(normalizeMeaning));
  const seen = new Set<string>();
  const alternates: string[] = [];
  for (const meaning of meanings) {
    const normalized = normalizeMeaning(meaning);
    if (!normalized || derived.has(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    alternates.push(meaning);
  }
  return alternates;
}

const READING_TYPE_LABEL = { onyomi: "On'yomi", kunyomi: "Kun'yomi" } as const;

/**
 * Shared trimmed answer panel for both the correct and incorrect reveal
 * (FR85, UX-DR8): reading + meaning only. Depth (mnemonic, examples) lives on
 * the details route under `review/` so the session provider never remounts.
 * Pure render — no fetching, no animations (NFR5b).
 */
export function AnswerReveal({ item, detail, collision }: AnswerRevealProps) {
  const alternates = meaningAlternates(item.displayMeaning, item.meanings);
  const kanjiReadings = detail?.kanjiReadings ?? [];
  // Fallback reading line when full kanji readings aren't prefetched, and the
  // reading line for vocabulary (skip kana-only tautologies: form === reading).
  const acceptedReadings =
    kanjiReadings.length === 0
      ? item.answerKey.acceptedReadings.filter((reading) => reading !== item.primaryForm)
      : [];

  return (
    <View className="w-full gap-space-sm rounded-radius-lg border border-border bg-surface p-space-md">
      <View>
        <Text className="text-overline font-ui-bold uppercase tracking-[0.08em] text-faint">
          Meaning
        </Text>
        <Text className="text-body-lg font-ui-semibold text-primary">{item.displayMeaning}</Text>
        {alternates.length > 0 ? (
          <Text className="text-body-sm font-ui text-secondary">
            Also accepted: {alternates.join(', ')}
          </Text>
        ) : null}
      </View>

      {kanjiReadings.length > 0 ? (
        <View>
          <Text className="text-overline font-ui-bold uppercase tracking-[0.08em] text-faint">
            Readings
          </Text>
          {(['onyomi', 'kunyomi'] as const).map((type) => {
            const readings = kanjiReadings.filter((r) => r.readingType === type);
            if (readings.length === 0) return null;
            return (
              <Text key={type} className="text-body font-jp-medium text-primary">
                {READING_TYPE_LABEL[type]}: {readings.map((r) => r.reading).join('、')}
              </Text>
            );
          })}
        </View>
      ) : acceptedReadings.length > 0 ? (
        <View>
          <Text className="text-overline font-ui-bold uppercase tracking-[0.08em] text-faint">
            Reading
          </Text>
          <Text className="text-body font-jp-medium text-primary">
            {acceptedReadings.join('、')}
          </Text>
        </View>
      ) : null}

      {collision ? (
        <View>
          <Text className="text-body-sm font-ui text-feedback-warning-deep">
            Your answer belongs to a different item: {collision.primaryForm}.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Compare with ${collision.primaryForm}`}
            onPress={() =>
              router.push({
                pathname: '/review/compare',
                params: { left: item.itemId, right: collision.itemId },
              } as Href)
            }
            className="min-h-[44px] justify-center">
            <Text className="text-body font-ui-semibold text-brand-text">Compare these items</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See full details"
        onPress={() => router.push(`/review/item/${item.itemId}` as Href)}
        className="min-h-[44px] justify-center">
        <Text className="text-body font-ui-semibold text-brand-text">See full details</Text>
      </Pressable>
    </View>
  );
}
