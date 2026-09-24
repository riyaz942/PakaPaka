/**
 * Curriculum versions are whole numbers that scripts/compile-curriculum.ts
 * raises by 1 on every compile. Versions from before that rule
 * ("1.13.1-jlpt-first-bands") parse as 0, so any numbered build replaces them.
 */
export function parseCurriculumVersion(version: string | number): number {
  const text = String(version).trim();
  return /^\d+$/.test(text) ? Number(text) : 0;
}

export function isCurriculumVersionNewer(
  candidateVersion: string | number,
  installedVersion: string | number,
): boolean {
  return parseCurriculumVersion(candidateVersion) > parseCurriculumVersion(installedVersion);
}
