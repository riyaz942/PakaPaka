import { isCurriculumVersionNewer, parseCurriculumVersion } from '@/data/curriculum/curriculumVersion';

describe('parseCurriculumVersion', () => {
  it('parses whole-number versions', () => {
    expect(parseCurriculumVersion('14')).toBe(14);
    expect(parseCurriculumVersion(14)).toBe(14);
  });

  it('treats versions from before whole numbers as 0', () => {
    expect(parseCurriculumVersion('1.13.1-jlpt-first-bands')).toBe(0);
  });
});

describe('isCurriculumVersionNewer', () => {
  it('compares versions as numbers, not text', () => {
    expect(isCurriculumVersionNewer('10', '9')).toBe(true);
    expect(isCurriculumVersionNewer(2, '1')).toBe(true);
  });

  it('returns false when versions are equal or older', () => {
    expect(isCurriculumVersionNewer('1', '1')).toBe(false);
    expect(isCurriculumVersionNewer('1', '2')).toBe(false);
  });

  it('treats any whole-number version as newer than a legacy version', () => {
    expect(isCurriculumVersionNewer('1', '1.13.1-jlpt-first-bands')).toBe(true);
    expect(isCurriculumVersionNewer('1.13.1-jlpt-first-bands', '1')).toBe(false);
  });
});
