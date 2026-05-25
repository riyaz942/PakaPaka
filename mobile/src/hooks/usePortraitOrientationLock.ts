import * as Device from 'expo-device';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Tablets keep system orientations; phones lock portrait (UX-DR28). */
export function shouldLockPortraitOrientation(
  deviceType: Device.DeviceType | null | undefined,
): boolean {
  return deviceType !== Device.DeviceType.TABLET;
}

/** Locks portrait on phones; tablets keep system default orientations (UX-DR28). */
export function usePortraitOrientationLock() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    if (!shouldLockPortraitOrientation(Device.deviceType)) {
      return;
    }

    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);

    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, []);
}
