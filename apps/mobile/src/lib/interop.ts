import { Canvas } from '@shopify/react-native-skia';
import { VelaLockup, VelaSymbol, VelaWordmark } from '@vela/brand/native';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { cssInterop } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

for (const Logo of [VelaSymbol, VelaWordmark, VelaLockup]) {
  cssInterop(Logo, {
    className: {
      target: 'style',
      nativeStyleToProp: { color: true },
    },
  });
}

cssInterop(GestureHandlerRootView, { className: 'style' });
cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Text, { className: 'style' });
cssInterop(BlurView, { className: 'style' });
cssInterop(Canvas, { className: 'style' });
cssInterop(SymbolView, { className: 'style' });
