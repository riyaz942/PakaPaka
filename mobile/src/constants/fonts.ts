import {
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  NotoSansJP_700Bold,
  NotoSansJP_900Black,
} from '@expo-google-fonts/noto-sans-jp';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  ZenMaruGothic_500Medium,
  ZenMaruGothic_700Bold,
  ZenMaruGothic_900Black,
} from '@expo-google-fonts/zen-maru-gothic';

/**
 * Design System v2 typefaces. Every face is a bundled asset — the app is
 * offline-first, so nothing here may be fetched at runtime.
 *
 * Static Google Fonts register one family per weight, so `fontWeight` cannot
 * pick a face: the matching NativeWind utility does. Weights mirror the
 * `fontFamily` block in `tailwind.config.js`.
 *
 * - Plus Jakarta Sans (`font-ui*`) — all interface text
 * - Zen Maru Gothic (`font-jp-round*`) — heroed Japanese characters
 * - Noto Sans JP (`font-jp*`) — readings, furigana, passages, chat
 */
export const appFonts = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  NotoSansJP_700Bold,
  NotoSansJP_900Black,
  ZenMaruGothic_500Medium,
  ZenMaruGothic_700Bold,
  ZenMaruGothic_900Black,
};
