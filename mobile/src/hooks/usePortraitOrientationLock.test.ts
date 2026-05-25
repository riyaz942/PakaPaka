import * as Device from 'expo-device';

import { shouldLockPortraitOrientation } from './usePortraitOrientationLock';

describe('shouldLockPortraitOrientation', () => {
  it('locks portrait on phones', () => {
    expect(shouldLockPortraitOrientation(Device.DeviceType.PHONE)).toBe(true);
  });

  it('does not lock on tablets', () => {
    expect(shouldLockPortraitOrientation(Device.DeviceType.TABLET)).toBe(false);
  });

  it('locks when device type is unknown', () => {
    expect(shouldLockPortraitOrientation(null)).toBe(true);
    expect(shouldLockPortraitOrientation(undefined)).toBe(true);
  });
});
