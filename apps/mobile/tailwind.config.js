const nativewindPreset = require('nativewind/preset');
const { velaPreset } = require('@vela/tokens/tailwind');

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [nativewindPreset, velaPreset],
};
