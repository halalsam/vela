import { colors, fontFamilies, radii, typeScale } from '@vela/tokens';
import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';

type StackOptions = NonNullable<ComponentProps<typeof Stack>['screenOptions']>;
type StaticStackOptions = Exclude<StackOptions, (...args: never[]) => unknown>;

export const baseStackOptions: StaticStackOptions = {
  contentStyle: { backgroundColor: colors.canvas.DEFAULT },
  headerTintColor: colors.fg.DEFAULT,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
  headerTitleStyle: { fontFamily: fontFamilies.sansSemibold, fontSize: 17 },
};

export const largeTitleStackOptions: StaticStackOptions = {
  ...baseStackOptions,
  headerLargeTitleEnabled: true,
  headerTransparent: true,
  // Without a blur the transparent header lets scrolled content run under the title and status bar.
  headerBlurEffect: 'systemChromeMaterialDark',
  headerLargeStyle: { backgroundColor: colors.canvas.DEFAULT },
  headerLargeTitleShadowVisible: false,
  headerLargeTitleStyle: {
    fontFamily: fontFamilies.display,
    fontSize: typeScale['display-xl'].fontSize,
  },
};

export const sheetOptions: StaticStackOptions = {
  presentation: 'formSheet',
  headerShown: false,
  sheetGrabberVisible: true,
  sheetCornerRadius: radii.sheet,
  sheetAllowedDetents: [0.6, 1],
  contentStyle: { backgroundColor: colors.surface[1] },
};
