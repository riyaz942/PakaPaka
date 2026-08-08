export type LoadOutcome = 'correct' | 'incorrect';

export type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export type DailyLoad = {
  date: string;
  load: number;
  threshold: number;
};
