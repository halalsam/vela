import type { ExpoConfig } from 'expo/config';

const MATTE_BLACK = '#0A0A0A';
const APP_GROUP = 'group.com.vela.app';

const fontsDir = '../../packages/brand/fonts';
const fontFiles = [
  'Manrope-Light',
  'Manrope-Regular',
  'Manrope-Medium',
  'Manrope-SemiBold',
  'Manrope-Bold',
  'InstrumentSerif-Regular',
  'InstrumentSerif-Italic',
  'IBMPlexSansArabic-Light',
  'IBMPlexSansArabic-Regular',
  'IBMPlexSansArabic-Medium',
  'IBMPlexSansArabic-SemiBold',
  'IBMPlexSansArabic-Bold',
].map((name) => `${fontsDir}/${name}.ttf`);

const config: ExpoConfig = {
  name: 'vela',
  slug: 'vela',
  owner: 'sammk21',
  scheme: 'vela',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: MATTE_BLACK,
  icon: './assets/brand/icon.png',
  ios: {
    bundleIdentifier: 'com.vela.app',
    supportsTablet: false,
    usesAppleSignIn: true,
    entitlements: {
      'com.apple.security.application-groups': [APP_GROUP],
    },
    infoPlist: {
      NSSupportsLiveActivities: true,
    },
    icon: {
      light: './assets/brand/icon.png',
      dark: './assets/brand/icon-ios-dark.png',
      tinted: './assets/brand/icon-ios-tinted.png',
    },
  },
  android: {
    package: 'com.vela.app',
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    adaptiveIcon: {
      backgroundColor: MATTE_BLACK,
      foregroundImage: './assets/brand/adaptive-foreground.png',
      backgroundImage: './assets/brand/adaptive-background.png',
      monochromeImage: './assets/brand/adaptive-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    ['expo-font', { fonts: fontFiles }],
    [
      'expo-splash-screen',
      {
        backgroundColor: MATTE_BLACK,
        android: {
          image: './assets/brand/splash-icon.png',
          imageWidth: 84,
          backgroundColor: MATTE_BLACK,
        },
      },
    ],
    ['expo-localization', { supportsRTL: true, supportedLocales: ['en', 'ar'] }],
    'expo-image',
    'expo-apple-authentication',
    'expo-notifications',
    '@bacons/apple-targets',
  ],
  extra: {
    eas: { projectId: 'cab987fb-afe2-4d68-ab10-3a90f7d3e2fd' },
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
