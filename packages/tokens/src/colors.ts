export const palette = {
  black: '#000000',
  matteBlack: '#0A0A0A',
  white: '#FFFFFF',
  ivory: '#F5F3EF',
  champagne: '#C8B285',
  champagneDeep: '#7D6838',
  green: '#3DDC97',
  amber: '#F5A524',
  red: '#FF5A5F',
} as const;

export const colors = {
  canvas: {
    DEFAULT: palette.matteBlack,
    deep: palette.black,
  },
  surface: {
    1: '#121212',
    2: '#1A1A1A',
    3: '#222222',
  },
  line: {
    DEFAULT: 'rgba(255,255,255,0.07)',
    highlight: 'rgba(255,255,255,0.11)',
    strong: 'rgba(255,255,255,0.16)',
  },
  fg: {
    DEFAULT: palette.white,
    secondary: 'rgba(255,255,255,0.64)',
    tertiary: 'rgba(255,255,255,0.40)',
    quaternary: 'rgba(255,255,255,0.24)',
    inverse: palette.matteBlack,
  },
  accent: {
    DEFAULT: palette.champagne,
    deep: palette.champagneDeep,
    tint: 'rgba(200,178,133,0.14)',
  },
  ivory: palette.ivory,
  success: {
    DEFAULT: palette.green,
    tint: 'rgba(61,220,151,0.14)',
  },
  warning: {
    DEFAULT: palette.amber,
    tint: 'rgba(245,165,36,0.14)',
  },
  danger: {
    DEFAULT: palette.red,
    tint: 'rgba(255,90,95,0.14)',
  },
} as const;

export const logoColors = {
  black: palette.matteBlack,
  white: palette.white,
  gold: palette.champagne,
} as const;

export type LogoColor = keyof typeof logoColors;
