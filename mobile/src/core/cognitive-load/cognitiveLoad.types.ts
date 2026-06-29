export type LoadOutcome = 'correct' | 'incorrect';

export type SessionIntensity = 'relaxed' | 'intense';

export type DailyLoad = {
  date: string;
  load: number;
  threshold: number;
};
