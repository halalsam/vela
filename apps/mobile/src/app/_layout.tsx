import '../global.css';
import '@/i18n';
import '@/lib/interop';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SplashGate } from '@/components/sections/SplashGate';
import { ToastViewport } from '@/components/ui';
import { useLanguageSync } from '@/i18n/useLanguageSync';
import { baseStackOptions, largeTitleStackOptions, sheetOptions } from '@/lib/navigation';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/stores/session';

const fullScreen = { headerShown: false, gestureEnabled: false } as const;

export default function RootLayout() {
  useLanguageSync();
  const hydrated = useSession((state) => state.hydrated);
  const onboardingSeen = useSession((state) => state.onboardingSeen);
  const signedIn = useSession((state) => state.signedIn);
  const inApp = onboardingSeen && signedIn;

  return (
    <GestureHandlerRootView className="flex-1 bg-canvas">
      <QueryClientProvider client={queryClient}>
        <SplashGate ready={hydrated}>
          <Stack screenOptions={baseStackOptions}>
            <Stack.Protected guard={!onboardingSeen}>
              <Stack.Screen name="onboarding" options={fullScreen} />
            </Stack.Protected>
            <Stack.Protected guard={onboardingSeen && !signedIn}>
              <Stack.Screen name="sign-in" options={fullScreen} />
            </Stack.Protected>
            <Stack.Protected guard={inApp}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="country/[code]" options={{ headerTransparent: true, title: '' }} />
              <Stack.Screen name="checkout" options={{ ...sheetOptions, sheetAllowedDetents: [0.85, 1] }} />
              <Stack.Screen name="processing" options={{ ...fullScreen, presentation: 'fullScreenModal', animation: 'fade' }} />
              <Stack.Screen name="success" options={{ ...fullScreen, presentation: 'fullScreenModal', animation: 'fade' }} />
              <Stack.Screen name="install" />
              <Stack.Screen name="usage/[iccid]" />
              <Stack.Screen name="top-up" options={{ ...sheetOptions, sheetAllowedDetents: [0.8, 1] }} />
              <Stack.Screen name="rewards" options={largeTitleStackOptions} />
              <Stack.Screen name="support" />
              <Stack.Screen name="dev/components" options={largeTitleStackOptions} />
              <Stack.Screen name="dev/sheet" options={sheetOptions} />
            </Stack.Protected>
          </Stack>
        </SplashGate>
        <ToastViewport />
        <StatusBar style="light" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
