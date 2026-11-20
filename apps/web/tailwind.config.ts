import type { Config } from 'tailwindcss';
import { velaPreset } from '@vela/tokens/tailwind';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/brand/src/web/**/*.{ts,tsx}'],
  presets: [velaPreset],
} satisfies Config;
