import type { SessionIntensity } from '@/data/user/sessionIntensity.types';

export const SESSION_INTENSITY_MINUTES: Record<SessionIntensity, number> = {
  relaxed: 15,
  intense: 30,
};
