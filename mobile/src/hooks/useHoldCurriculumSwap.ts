import { useEffect } from 'react';

import { holdCurriculumSwap } from '@/data/curriculum/curriculumSwapGate';

/** Keeps the curriculum swap waiting while the calling screen is mounted. */
export function useHoldCurriculumSwap(): void {
  useEffect(() => holdCurriculumSwap(), []);
}
