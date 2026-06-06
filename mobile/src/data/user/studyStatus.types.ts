export type StudyStatus = 'known' | 'in_progress' | 'not_started';

export const STUDY_STATUS_VALUES: readonly StudyStatus[] = [
  'known',
  'in_progress',
  'not_started',
] as const;

export function isStudyStatus(value: string): value is StudyStatus {
  return (STUDY_STATUS_VALUES as readonly string[]).includes(value);
}
