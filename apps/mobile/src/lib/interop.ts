import { VelaLockup, VelaSymbol, VelaWordmark } from '@vela/brand/native';
import { cssInterop } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

for (const Logo of [VelaSymbol, VelaWordmark, VelaLockup]) {
  cssInterop(Logo, {
    className: {
      target: 'style',
      nativeStyleToProp: { color: true },
    },
  });
}

cssInterop(GestureHandlerRootView, { className: 'style' });
