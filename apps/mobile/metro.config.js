const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem 16 matches Tailwind's web scale, which the design tokens and every
// hand-sized component (rings, odometer reels, swipe thumb) assume. NativeWind's
// native default of 14 shrank `h-28` to 98pt and cropped or misaligned them.
module.exports = withNativeWind(config, { input: './src/global.css', inlineRem: 16 });
