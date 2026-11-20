import '../global.css';
import '@/i18n';
import '@/lib/interop';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ToastViewport } from '@/components/ui';
import { baseStackOptions, largeTitleStackOptions, sheetOptions } from '@/lib/navigation';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <GestureHandlerRootView className="flex-1 bg-canvas">
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={baseStackOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="country/[code]" options={{ headerTransparent: true }} />
          <Stack.Screen name="checkout" options={sheetOptions} />
          <Stack.Screen
            name="processing"
            options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }}
          />
          <Stack.Screen name="success" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="install" />
          <Stack.Screen name="usage/[iccid]" />
          <Stack.Screen name="top-up" options={sheetOptions} />
          <Stack.Screen name="rewards" />
          <Stack.Screen name="support" />
          <Stack.Screen name="dev/components" options={largeTitleStackOptions} />
          <Stack.Screen name="dev/sheet" options={sheetOptions} />
        </Stack>
        <ToastViewport />
        <StatusBar style="light" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
