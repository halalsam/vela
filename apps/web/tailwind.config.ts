import type { Config } from 'tailwindcss';
import { velaPreset } from '@vela/tokens/tailwind';
import { easingCss } from '@vela/tokens';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/brand/src/web/**/*.{ts,tsx}'],
  presets: [velaPreset],
  theme: {
    extend: {
      keyframes: {
        'ring-draw': { from: { strokeDashoffset: '183' } },
        rise: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        flip: { from: { transform: 'perspective(900px) rotateY(-180deg)' }, to: { transform: 'perspective(900px) rotateY(0)' } },
      },
      animation: {
        'ring-draw': `ring-draw 900ms ${easingCss.vela} both`,
        rise: `rise 450ms ${easingCss.vela} both`,
        fade: `fade 280ms ${easingCss.vela} both`,
        flip: `flip 700ms ${easingCss.vela} both`,
      },
    },
  },
} satisfies Config;
