import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { FILL_SPRING, STAGGER_MS } from '@/constants/motion';
import type { ReviewForecast as ReviewForecastData } from '@/core/engagement/reviewForecast';
import { useReducedMotion } from '@/data/hooks/useReducedMotion';
import { cn } from '@/utils/cn';

type ReviewForecastProps = {
  forecast: ReviewForecastData;
};

/** Bar-column well, from the spec's 44px chart. */
const CHART_HEIGHT = 44;
/** A day with nothing due still draws a stub, so the week reads as seven columns. */
const EMPTY_BAR_HEIGHT = 4;

/** One column: grows up from the floor, each day a little after the one before. */
function ForecastBar({
  height,
  index,
  className,
}: {
  height: number;
  index: number;
  className: string;
}) {
  const { reducedMotion } = useReducedMotion();
  const grown = useSharedValue(reducedMotion ? height : 0);

  useEffect(() => {
    grown.value = reducedMotion
      ? height
      : withDelay(index * STAGGER_MS, withSpring(height, FILL_SPRING));
  }, [grown, reducedMotion, height, index]);

  const style = useAnimatedStyle(() => ({ height: grown.value }));

  return <Animated.View className={className} style={style} />;
}

/**
 * One-week due forecast (FR58). Wall days get an invitation-style annotation
 * (UX-DR4) — plan lightly, never an alarm.
 *
 * The chart is jade only: today is a solid `brand-500` column, the days ahead
 * are `brand-200`, and an empty day is a `surface-elevated` stub. Bars scale to
 * the busiest day of the week rather than an absolute count, so a light week
 * still has shape.
 */
export function ReviewForecast({ forecast }: ReviewForecastProps) {
  const wallDay = forecast.wallDateKey
    ? forecast.days.find((day) => day.dateKey === forecast.wallDateKey)
    : null;

  const summary =
    `${forecast.totalCount} this week · ${forecast.dueNowCount} due now` +
    (forecast.laterTodayCount > 0 ? `, ${forecast.laterTodayCount} more later today` : '');

  const peak = Math.max(...forecast.days.map((day) => day.count), 1);

  return (
    <View
      testID="review-forecast"
      accessibilityLabel={`Review forecast for the next seven days, ${forecast.totalCount} reviews scheduled`}
      className="rounded-radius-lg border border-border bg-surface p-space-md shadow-e1">
      <Text className="text-body font-ui-extrabold text-primary">This week</Text>

      {forecast.totalCount === 0 ? (
        <Text
          className="mt-space-xs text-caption font-ui-medium text-muted"
          testID="review-forecast-empty">
          No reviews scheduled yet — your first lessons will fill this in.
        </Text>
      ) : (
        <Text
          className="mt-space-xs text-caption font-ui-medium text-muted"
          testID="forecast-summary">
          {summary}
        </Text>
      )}

      {forecast.totalCount > 0 ? (
        <View className="mt-space-sm flex-row items-end gap-space-xs">
          {forecast.days.map((day, index) => {
            const isWall = day.dateKey === forecast.wallDateKey;
            const empty = day.count === 0;
            const barHeight = empty
              ? EMPTY_BAR_HEIGHT
              : Math.max(EMPTY_BAR_HEIGHT, Math.round((day.count / peak) * CHART_HEIGHT));

            return (
              <View
                key={day.dateKey}
                testID={`forecast-day-${day.dateKey}`}
                className="flex-1 items-center">
                <View className="w-full justify-end" style={{ height: CHART_HEIGHT }}>
                  <ForecastBar
                    height={barHeight}
                    index={index}
                    className={cn(
                      'w-full rounded-radius-sm',
                      empty ? 'bg-surface-elevated' : day.isToday ? 'bg-brand-500' : 'bg-brand-200',
                      // The wall day is the one spike worth naming; it keeps a jade
                      // outline to tie the column to the note under the chart.
                      isWall && !day.isToday && 'border-[1.5px] border-brand-500',
                    )}
                  />
                </View>
                <Text
                  className={cn(
                    'mt-space-xs text-body-sm',
                    day.isToday
                      ? 'font-ui-extrabold text-primary'
                      : empty
                        ? 'font-ui-bold text-faint'
                        : 'font-ui-bold text-secondary',
                  )}>
                  {day.count}
                </Text>
                <Text
                  className={cn(
                    'text-caption',
                    day.isToday ? 'font-ui-semibold text-brand-text' : 'font-ui-medium text-faint',
                  )}>
                  {day.isToday ? 'Today' : day.weekdayLabel}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {wallDay ? (
        <Text
          className="mt-space-sm text-caption font-ui-medium text-brand-text"
          testID="forecast-wall-note">
          {`Wall day ${wallDay.weekdayLabel} — ${wallDay.count} due. Go light on lessons.`}
        </Text>
      ) : null}
    </View>
  );
}
