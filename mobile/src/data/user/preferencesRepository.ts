import type { SQLiteDatabase } from 'expo-sqlite';

import type { CurriculumUpdateSource } from '@/data/curriculum/curriculumManifest.types';
import { isJlptLevel, type JLPTLevel } from '@/data/curriculum/curriculum.types';
import {
  isSessionIntensity,
  type SessionIntensity,
} from '@/data/user/sessionIntensity.types';

export type OnboardingPath = 'beginner' | 'manual' | 'import';

export const PREFERENCE_KEYS = {
  installedCurriculumVersion: 'installed_curriculum_version',
  installedCurriculumContentHash: 'installed_curriculum_content_hash',
  curriculumUpdateSource: 'curriculum_update_source',
  startingJlptLevel: 'starting_jlpt_level',
  sessionIntensity: 'session_intensity',
  onboardingCompleted: 'onboarding_completed',
  onboardingPath: 'onboarding_path',
  weaknessBiasEnabled: 'weakness_bias_enabled',
  notificationsEnabled: 'notifications_enabled',
  notificationReminderTime: 'notification_reminder_time',
  reducedMotion: 'reduced_motion',
  reviewAutoAdvance: 'review_auto_advance',
  furiganaDisplay: 'furigana_display',
  shadowModeEnabled: 'shadow_mode_enabled',
  shadowModeEnabledAt: 'shadow_mode_enabled_at',
  shadowModePromptDismissed: 'shadow_mode_prompt_dismissed',
  shadowModePromptSnoozedUntil: 'shadow_mode_prompt_snoozed_until',
  seenKanjiReadingPrimer: 'seen_kanji_reading_primer',
  // BYOK config that is not a secret — the key itself lives in secure storage
  // (see data/ai/byokCredentialStore.ts); these four do not.
  aiOpenAiBaseUrl: 'ai_openai_base_url',
  aiActiveProvider: 'ai_active_provider',
  aiOpenAiModel: 'ai_openai_model',
  aiAnthropicModel: 'ai_anthropic_model',
} as const;

const ONBOARDING_PATHS: readonly OnboardingPath[] = ['beginner', 'manual', 'import'];

function isOnboardingPath(value: string): value is OnboardingPath {
  return (ONBOARDING_PATHS as readonly string[]).includes(value);
}

export function getPreference(
  userDb: SQLiteDatabase,
  key: string,
): string | null {
  const row = userDb.getFirstSync<{ value: string }>(
    'SELECT value FROM user_preferences WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export function setPreference(
  userDb: SQLiteDatabase,
  key: string,
  value: string,
): void {
  const updatedAt = new Date().toISOString();
  userDb.runSync(
    `INSERT INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    updatedAt,
  );
}

export function getCurriculumUpdateSource(
  userDb: SQLiteDatabase,
): CurriculumUpdateSource | null {
  const value = getPreference(userDb, PREFERENCE_KEYS.curriculumUpdateSource);
  if (value === 'bundled' || value === 'downloaded') {
    return value;
  }
  return null;
}

export function getStartingJlptLevel(userDb: SQLiteDatabase): JLPTLevel | null {
  const value = getPreference(userDb, PREFERENCE_KEYS.startingJlptLevel);
  if (value && isJlptLevel(value)) {
    return value;
  }
  return null;
}

export function setStartingJlptLevel(userDb: SQLiteDatabase, level: JLPTLevel): void {
  if (!isJlptLevel(level)) {
    throw new Error(`Invalid JLPT level: ${level}`);
  }
  setPreference(userDb, PREFERENCE_KEYS.startingJlptLevel, level);
}

export function getSessionIntensity(userDb: SQLiteDatabase): SessionIntensity | null {
  const value = getPreference(userDb, PREFERENCE_KEYS.sessionIntensity);
  if (value && isSessionIntensity(value)) {
    return value;
  }
  return null;
}

export function setSessionIntensity(
  userDb: SQLiteDatabase,
  intensity: SessionIntensity,
): void {
  if (!isSessionIntensity(intensity)) {
    throw new Error(`Invalid session intensity: ${intensity}`);
  }
  setPreference(userDb, PREFERENCE_KEYS.sessionIntensity, intensity);
}

export function isOnboardingCompleted(userDb: SQLiteDatabase): boolean {
  return getPreference(userDb, PREFERENCE_KEYS.onboardingCompleted) === 'true';
}

export function setOnboardingCompleted(userDb: SQLiteDatabase): void {
  setPreference(userDb, PREFERENCE_KEYS.onboardingCompleted, 'true');
}

export function getOnboardingPath(userDb: SQLiteDatabase): OnboardingPath | null {
  const value = getPreference(userDb, PREFERENCE_KEYS.onboardingPath);
  if (value && isOnboardingPath(value)) {
    return value;
  }
  return null;
}

export function setOnboardingPath(userDb: SQLiteDatabase, path: OnboardingPath): void {
  if (!isOnboardingPath(path)) {
    throw new Error(`Invalid onboarding path: ${path}`);
  }
  setPreference(userDb, PREFERENCE_KEYS.onboardingPath, path);
}

export function clearOnboardingCompleted(userDb: SQLiteDatabase): void {
  userDb.runSync('DELETE FROM user_preferences WHERE key = ?', PREFERENCE_KEYS.onboardingCompleted);
}

/**
 * Returns true when weakness bias is enabled (default when unset).
 * Stored as 'true'/'false' string to match existing preference storage pattern.
 */
export function getWeaknessBiasEnabled(userDb: SQLiteDatabase): boolean {
  const value = getPreference(userDb, PREFERENCE_KEYS.weaknessBiasEnabled);
  // Default is enabled (true) when the key is not set.
  return value === null ? true : value === 'true';
}

export function setWeaknessBiasEnabled(userDb: SQLiteDatabase, enabled: boolean): void {
  setPreference(userDb, PREFERENCE_KEYS.weaknessBiasEnabled, enabled ? 'true' : 'false');
}

/**
 * Returns the in-app reduced-motion override, or null when unset (follow system).
 */
export function getReducedMotionEnabled(userDb: SQLiteDatabase): boolean | null {
  const value = getPreference(userDb, PREFERENCE_KEYS.reducedMotion);
  if (value === null) {
    return null;
  }
  return value === 'true';
}

export function setReducedMotionEnabled(userDb: SQLiteDatabase, enabled: boolean): void {
  setPreference(userDb, PREFERENCE_KEYS.reducedMotion, enabled ? 'true' : 'false');
}

/**
 * Returns true when auto-advance after a correct review answer (Lightning Mode)
 * is enabled. Default is OFF when unset (FR84): the review loop waits for
 * Return/Continue unless the learner opts in via Settings.
 */
export function getReviewAutoAdvanceEnabled(userDb: SQLiteDatabase): boolean {
  return getPreference(userDb, PREFERENCE_KEYS.reviewAutoAdvance) === 'true';
}

export function setReviewAutoAdvanceEnabled(userDb: SQLiteDatabase, enabled: boolean): void {
  setPreference(userDb, PREFERENCE_KEYS.reviewAutoAdvance, enabled ? 'true' : 'false');
}

/**
 * Global furigana display preference. In 'auto', visibility is resolved per
 * surface: vocabulary item's own mastery (Tier 1) or characters appearing in
 * mastered vocabulary (Tier 2) — never merely because a standalone kanji item
 * is mastered (FR78 / BUG6). Default is 'auto', not 'shown' — furigana should
 * help on unfamiliar words by default.
 */
export type FuriganaDisplayMode = 'shown' | 'hidden' | 'auto';

const FURIGANA_DISPLAY_MODES: readonly FuriganaDisplayMode[] = ['shown', 'hidden', 'auto'];

export function isFuriganaDisplayMode(value: string): value is FuriganaDisplayMode {
  return (FURIGANA_DISPLAY_MODES as readonly string[]).includes(value);
}

export function getFuriganaDisplay(userDb: SQLiteDatabase): FuriganaDisplayMode {
  const value = getPreference(userDb, PREFERENCE_KEYS.furiganaDisplay);
  if (value && isFuriganaDisplayMode(value)) {
    return value;
  }
  return 'auto';
}

export function setFuriganaDisplay(userDb: SQLiteDatabase, mode: FuriganaDisplayMode): void {
  if (!isFuriganaDisplayMode(mode)) {
    throw new Error(`Invalid furigana display mode: ${mode}`);
  }
  setPreference(userDb, PREFERENCE_KEYS.furiganaDisplay, mode);
}

export type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'night';

export const NOTIFICATION_TIME_HOURS: Record<NotificationTime, number> = {
  morning: 8,
  afternoon: 13,
  evening: 19,
  night: 21,
};

const NOTIFICATION_TIMES: readonly NotificationTime[] = [
  'morning',
  'afternoon',
  'evening',
  'night',
];

function isNotificationTime(value: string): value is NotificationTime {
  return (NOTIFICATION_TIMES as readonly string[]).includes(value);
}

export function getNotificationsEnabled(userDb: SQLiteDatabase): boolean {
  return getPreference(userDb, PREFERENCE_KEYS.notificationsEnabled) === 'true';
}

export function setNotificationsEnabled(userDb: SQLiteDatabase, enabled: boolean): void {
  setPreference(userDb, PREFERENCE_KEYS.notificationsEnabled, enabled ? 'true' : 'false');
}

export function getNotificationTime(userDb: SQLiteDatabase): NotificationTime {
  const value = getPreference(userDb, PREFERENCE_KEYS.notificationReminderTime);
  if (value && isNotificationTime(value)) {
    return value;
  }
  return 'evening';
}

export function setNotificationTime(userDb: SQLiteDatabase, time: NotificationTime): void {
  if (!isNotificationTime(time)) {
    throw new Error(`Invalid notification time: ${time}`);
  }
  setPreference(userDb, PREFERENCE_KEYS.notificationReminderTime, time);
}

/**
 * Returns true when shadow mode is enabled (default false when unset).
 * Shadow mode is a UX framing only — it never affects the review queue, FSRS
 * scheduling, or due counts.
 */
export function getShadowModeEnabled(userDb: SQLiteDatabase): boolean {
  return getPreference(userDb, PREFERENCE_KEYS.shadowModeEnabled) === 'true';
}

/**
 * Enables/disables shadow mode. On the first enable (when `enabled_at` is not
 * already set), stamps `shadow_mode_enabled_at` with the current ISO timestamp.
 * Re-enabling does not overwrite the original timestamp, and disabling never
 * clears it, so a later re-enable preserves continuity of "days active".
 */
export function setShadowModeEnabled(userDb: SQLiteDatabase, enabled: boolean): void {
  setPreference(userDb, PREFERENCE_KEYS.shadowModeEnabled, enabled ? 'true' : 'false');
  if (enabled && getShadowModeEnabledAt(userDb) === null) {
    setShadowModeEnabledAt(userDb, new Date().toISOString());
  }
}

export function getShadowModeEnabledAt(userDb: SQLiteDatabase): string | null {
  return getPreference(userDb, PREFERENCE_KEYS.shadowModeEnabledAt);
}

export function setShadowModeEnabledAt(userDb: SQLiteDatabase, iso: string): void {
  setPreference(userDb, PREFERENCE_KEYS.shadowModeEnabledAt, iso);
}

export function getShadowModePromptDismissed(userDb: SQLiteDatabase): boolean {
  return getPreference(userDb, PREFERENCE_KEYS.shadowModePromptDismissed) === 'true';
}

export function setShadowModePromptDismissed(userDb: SQLiteDatabase, dismissed: boolean): void {
  setPreference(userDb, PREFERENCE_KEYS.shadowModePromptDismissed, dismissed ? 'true' : 'false');
}

export function getShadowModePromptSnoozedUntil(userDb: SQLiteDatabase): string | null {
  return getPreference(userDb, PREFERENCE_KEYS.shadowModePromptSnoozedUntil);
}

export function setShadowModePromptSnoozedUntil(userDb: SQLiteDatabase, iso: string): void {
  setPreference(userDb, PREFERENCE_KEYS.shadowModePromptSnoozedUntil, iso);
}

/**
 * True once the on'yomi/kun'yomi primer has been shown unprompted (FR74).
 * Defaults to false so a fresh beginner sees it exactly once; there is no
 * "un-see" setter — the primer stays reachable through the readings heading
 * info affordance instead.
 */
export function getSeenKanjiReadingPrimer(userDb: SQLiteDatabase): boolean {
  return getPreference(userDb, PREFERENCE_KEYS.seenKanjiReadingPrimer) === 'true';
}

export function setSeenKanjiReadingPrimer(userDb: SQLiteDatabase): void {
  setPreference(userDb, PREFERENCE_KEYS.seenKanjiReadingPrimer, 'true');
}

export function setCurriculumInstallMetadata(
  userDb: SQLiteDatabase,
  options: {
    version: string;
    source: CurriculumUpdateSource;
    contentHash?: string | null;
  },
): void {
  setPreference(userDb, PREFERENCE_KEYS.installedCurriculumVersion, options.version);
  setPreference(userDb, PREFERENCE_KEYS.curriculumUpdateSource, options.source);
  if (options.contentHash) {
    setPreference(userDb, PREFERENCE_KEYS.installedCurriculumContentHash, options.contentHash);
  }
}

/**
 * OpenAI-compatible base URL (FR88). Not a credential — it is user-editable
 * config, so it lives here rather than in secure storage. Null means "not set";
 * the caller applies `DEFAULT_OPENAI_BASE_URL`.
 */
export function getAiOpenAiBaseUrl(userDb: SQLiteDatabase): string | null {
  return getPreference(userDb, PREFERENCE_KEYS.aiOpenAiBaseUrl);
}

export function setAiOpenAiBaseUrl(userDb: SQLiteDatabase, baseUrl: string): void {
  const trimmed = baseUrl.trim();
  if (trimmed.length === 0) {
    // Empty must clear, not store "": callers use `?? DEFAULT_OPENAI_BASE_URL`.
    userDb.runSync(
      'DELETE FROM user_preferences WHERE key = ?',
      PREFERENCE_KEYS.aiOpenAiBaseUrl,
    );
    return;
  }
  setPreference(userDb, PREFERENCE_KEYS.aiOpenAiBaseUrl, trimmed);
}

/**
 * Which adapter new sessions use. Both providers can be configured at once
 * (FR88), so the choice is an explicit, visible setting rather than an implicit
 * "whichever key we found first" — no hidden fallback path. Null means the
 * caller should default to the single configured provider.
 */
export function getAiActiveProvider(userDb: SQLiteDatabase): string | null {
  return getPreference(userDb, PREFERENCE_KEYS.aiActiveProvider);
}

export function setAiActiveProvider(userDb: SQLiteDatabase, provider: string): void {
  setPreference(userDb, PREFERENCE_KEYS.aiActiveProvider, provider);
}

/** Per-provider model id override. Null means the adapter's documented default. */
export function getAiModel(userDb: SQLiteDatabase, provider: 'openai' | 'anthropic'): string | null {
  return getPreference(
    userDb,
    provider === 'openai' ? PREFERENCE_KEYS.aiOpenAiModel : PREFERENCE_KEYS.aiAnthropicModel,
  );
}

export function setAiModel(
  userDb: SQLiteDatabase,
  provider: 'openai' | 'anthropic',
  model: string,
): void {
  setPreference(
    userDb,
    provider === 'openai' ? PREFERENCE_KEYS.aiOpenAiModel : PREFERENCE_KEYS.aiAnthropicModel,
    model.trim(),
  );
}
