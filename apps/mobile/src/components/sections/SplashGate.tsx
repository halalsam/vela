import * as SplashScreen from 'expo-splash-screen';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeOut, ReduceMotion } from 'react-native-reanimated';
import { VelaSplash } from '@/components/esim';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const fadeOut = FadeOut.duration(320).reduceMotion(ReduceMotion.Never);

export function SplashGate({ ready, children }: { ready: boolean; children: ReactNode }) {
  const [played, setPlayed] = useState(false);
  const showOverlay = !played || !ready;
  return (
    <View className="flex-1 bg-canvas">
      {ready ? children : null}
      {showOverlay ? (
        <Animated.View
          exiting={fadeOut}
          onLayout={() => {
            SplashScreen.hideAsync().catch(() => undefined);
          }}
          className="absolute inset-0 items-center justify-center bg-canvas"
        >
          <VelaSplash mode="intro" markHeight={64} onFinish={() => setPlayed(true)} className="h-40" />
        </Animated.View>
      ) : null}
    </View>
  );
}
