import { Text, View } from 'react-native';

import type { ReviewForecast as ReviewForecastData } from '@/core/engagement/reviewForecast';
import { cn } from '@/utils/cn';

type ReviewForecastProps = {
  forecast: ReviewForecastData;
};

/**
 * One-week due forecast (FR58). Wall days get an invitation-style annotation
 * (UX-DR4) — plan lightly, never an alarm.
 */
export function ReviewForecast({ forecast }: ReviewForecastProps) {
  const wallDay = forecast.wallDateKey
    ? forecast.days.find((day) => day.dateKey === forecast.wallDateKey)
    : null;

  return (
    <View
      testID="review-forecast"
      accessibilityLabel={`Review forecast for the next seven days, ${forecast.totalCount} reviews scheduled`}
      className="rounded-radius-lg border border-border bg-surface p-space-md">
      <Text className="text-body font-semibold text-primary">This week</Text>

      {forecast.totalCount === 0 ? (
        <Text className="mt-space-sm text-body-sm text-secondary" testID="review-forecast-empty">
          No reviews scheduled yet — your first lessons will fill this in.
        </Text>
      ) : (
        <View className="mt-space-sm flex-row justify-between">
          {forecast.days.map((day) => {
            const isWall = day.dateKey === forecast.wallDateKey;
            return (
              <View
                key={day.dateKey}
                testID={`forecast-day-${day.dateKey}`}
                className={cn(
                  'min-w-[36px] items-center rounded-radius-sm px-space-xs py-space-xs',
                  day.isToday && 'bg-surface-elevated',
                  isWall && 'border border-feedback-info',
                )}>
                <Text
                  className={cn(
                    'text-body-sm font-semibold',
                    isWall ? 'text-feedback-info' : 'text-primary',
                  )}>
                  {day.count}
                </Text>
                <Text className="mt-space-xs text-caption text-secondary">
                  {day.isToday ? 'Today' : day.weekdayLabel}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {wallDay ? (
        <Text className="mt-space-sm text-body-sm text-feedback-info" testID="forecast-wall-note">
          {`Wall day ${wallDay.weekdayLabel} — ${wallDay.count} due. Go light on lessons.`}
        </Text>
      ) : null}
    </View>
  );
}
