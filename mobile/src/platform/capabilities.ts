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

/** Background curriculum OTA swap. */
export const supportsCurriculumOta = (): boolean => !isWeb();

/** WaniKani / Bunpro / Anki import (needs secure storage or the file system). */
export const supportsThirdPartyImport = (): boolean => !isWeb();
