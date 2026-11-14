import { AccessibilityInfo, Platform, type View } from 'react-native';

import { focusScreenReaderOn } from '@/utils/accessibilityFocus';

describe('focusScreenReaderOn', () => {
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    jest.restoreAllMocks();
  });

  it('does not touch native node handles on web, where react-native-web reports a screen reader as always on', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);

    // A bare object is not a mounted native view: findNodeHandle would throw on web.
    await expect(focusScreenReaderOn({} as View)).resolves.toBeUndefined();
  });

  it('does nothing when no screen reader is active', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});

    await focusScreenReaderOn({} as View);

    expect(focus).not.toHaveBeenCalled();
  });
});
