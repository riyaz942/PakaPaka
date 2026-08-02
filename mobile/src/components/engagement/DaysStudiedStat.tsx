import { Icon } from '@/components/common/Icon';
import { StatTile } from '@/components/stats/StatTile';

type DaysStudiedStatProps = {
  daysStudied: number;
};

/**
 * Calm monthly activity (UX-DR20): a plain count, deliberately not a streak —
 * no flame, no at-risk state, zero shown without drama. The calendar mark is
 * the drawn icon, never the spec's streak flame.
 */
export function DaysStudiedStat({ daysStudied }: DaysStudiedStatProps) {
  return (
    <StatTile
      testID="days-studied-stat"
      accessibilityLabel={`${daysStudied} days studied this month`}
      value={daysStudied}
      label="Days studied"
      caption="this month · not a streak"
      icon={<Icon name="days" size={20} className="text-brand-500" />}
    />
  );
}
