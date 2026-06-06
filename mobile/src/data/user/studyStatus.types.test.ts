import { isStudyStatus } from '@/data/user/studyStatus.types';

describe('isStudyStatus', () => {
  it('accepts valid study status literals', () => {
    expect(isStudyStatus('known')).toBe(true);
    expect(isStudyStatus('in_progress')).toBe(true);
    expect(isStudyStatus('not_started')).toBe(true);
  });

  it('rejects invalid values', () => {
    expect(isStudyStatus('mastered')).toBe(false);
    expect(isStudyStatus('Known')).toBe(false);
    expect(isStudyStatus('')).toBe(false);
    expect(isStudyStatus('in progress')).toBe(false);
  });
});
