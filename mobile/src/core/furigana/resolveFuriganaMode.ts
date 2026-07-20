import type { FuriganaOverrideMode } from '@/data/user/furiganaOverrideRepository';
import type { FuriganaDisplayMode } from '@/data/user/preferencesRepository';

/**
 * First tier of furigana resolution (FR79, UX-DR19/33):
 * Settings override → SRS default → global preference mode.
 *
 * This function covers the outer two tiers. The middle tier lives in
 * `defaultFuriganaVisible`, which only consults mastery when the mode it is
 * handed is 'auto' — and an override never resolves to 'auto', so a word with
 * an override skips the SRS default entirely.
 *
 * Type-only imports keep this pure (no React, no SQLite).
 */
export function resolveFuriganaMode(
  override: FuriganaOverrideMode | null | undefined,
  globalMode: FuriganaDisplayMode,
): FuriganaDisplayMode {
  return override ?? globalMode;
}
