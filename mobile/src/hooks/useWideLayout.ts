import { useWindowDimensions, type ViewStyle } from 'react-native';

import { MaxSheetWidth, WideLayoutMinWidth } from '@/constants/theme';
import { isWeb } from '@/platform/capabilities';

/**
 * True when the web build runs in a desktop-sized window. Screens use it to
 * switch from the phone layout to their desktop layout. Native always gets the
 * phone layout.
 */
export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return isWeb() && width >= WideLayoutMinWidth;
}

type SheetFrame = {
  /** Added to the sheet panel. */
  className?: string;
  style?: ViewStyle;
  /** Added to the dimmed backdrop, when the backdrop is a sibling of the panel. */
  backdropClassName?: string;
};

const PHONE_SHEET: SheetFrame = {};
const DESKTOP_SHEET: SheetFrame = {
  className: 'mt-auto mb-space-xl w-full self-center rounded-radius-xl border',
  style: { maxWidth: MaxSheetWidth },
  // The card leaves window visible beside and below it, so the backdrop
  // covers the whole window rather than only the space above the card.
  backdropClassName: 'absolute inset-0',
};

/**
 * Extra classes and style for a bottom sheet. On a desktop window the sheet
 * floats as a centered card above the bottom edge instead of spanning the
 * whole window.
 */
export function useSheetFrame(): SheetFrame {
  return useWideLayout() ? DESKTOP_SHEET : PHONE_SHEET;
}
