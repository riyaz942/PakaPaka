import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

import { isWeb } from '@/platform/capabilities';

// On web, Reanimated's Animated.View drops `className`, so its classes never
// reach the DOM: the goal ring label sat off-centre and progress fills and
// forecast bars had no size or colour. Registering it lets NativeWind turn the
// classes into style, the same fix PressableScale uses for its wrapper.
if (isWeb()) {
  cssInterop(Animated.View, { className: 'style' });
}
