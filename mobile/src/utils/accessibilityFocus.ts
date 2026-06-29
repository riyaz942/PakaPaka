import { AccessibilityInfo, findNodeHandle, type View } from 'react-native';

/** Moves VoiceOver/TalkBack focus to a mounted view when a screen reader is active. */
export async function focusScreenReaderOn(view: View | null): Promise<void> {
  const enabled = await AccessibilityInfo.isScreenReaderEnabled();
  if (!enabled || view == null) {
    return;
  }

  const tag = findNodeHandle(view);
  if (tag != null) {
    AccessibilityInfo.setAccessibilityFocus(tag);
  }
}
