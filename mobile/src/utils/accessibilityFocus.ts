import { AccessibilityInfo, findNodeHandle, type View } from 'react-native';

import { isWeb } from '@/platform/capabilities';

/** Moves VoiceOver/TalkBack focus to a mounted view when a screen reader is active. */
export async function focusScreenReaderOn(view: View | null): Promise<void> {
  // react-native-web has no findNodeHandle (it throws) and reports a screen reader as
  // always on; browser assistive tech follows DOM focus instead.
  if (isWeb()) {
    return;
  }

  const enabled = await AccessibilityInfo.isScreenReaderEnabled();
  if (!enabled || view == null) {
    return;
  }

  const tag = findNodeHandle(view);
  if (tag != null) {
    AccessibilityInfo.setAccessibilityFocus(tag);
  }
}
