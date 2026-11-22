import { Platform } from 'react-native';

/**
 * The only place that decides what exists on web. Each function reads
 * `Platform.OS` at call time so tests can switch the platform.
 */
export const isWeb = (): boolean => Platform.OS === 'web';

/** Talk tab and its routes (BYOK AI conversation). */
export const supportsTalk = (): boolean => !isWeb();

/** On-device TTS / STT and the voice-model download. */
export const supportsVoice = (): boolean => !isWeb();

/** Local notification reminders. */
export const supportsNotifications = (): boolean => !isWeb();

/** `Appearance.setColorScheme`; on web the theme follows the system. */
export const supportsThemeOverride = (): boolean => !isWeb();

/** expo-network on web has no connection type. */
export const curriculumDownloadNeedsWifi = (): boolean => !isWeb();

/** WaniKani / Bunpro / Anki import (needs secure storage or the file system). */
export const supportsThirdPartyImport = (): boolean => !isWeb();

/** Native Google sign-in (system browser + token exchange); web uses the cookie flow. */
export const supportsNativeGoogleSignIn = (): boolean =>
  Platform.OS === 'ios' || Platform.OS === 'android';

/** Android tokens carry the web client ID as audience; only iOS needs its own client ID. */
export const needsIosGoogleClientId = (): boolean => Platform.OS === 'ios';

/** Web authenticates with HttpOnly cookies instead of stored tokens. */
export const usesCookieSession = (): boolean => isWeb();

/** `withExclusiveTransactionAsync`; expo-sqlite on web throws, so sync uses `withTransactionAsync` there. */
export const supportsExclusiveTransaction = (): boolean => !isWeb();
