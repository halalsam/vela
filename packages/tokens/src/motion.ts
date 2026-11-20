export const easing = {
  vela: [0.22, 1, 0.36, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export const easingCss = {
  vela: `cubic-bezier(${easing.vela.join(', ')})`,
} as const;

export const spring = {
  response: 0.45,
  dampingFraction: 0.85,
} as const;

export const reanimatedSpring = {
  duration: spring.response * 1000,
  dampingRatio: spring.dampingFraction,
} as const;

export const durations = {
  instant: 100,
  fast: 180,
  base: 280,
  slow: 450,
  splash: 1400,
  splashLoop: 1700,
  splashHold: 250,
  splashReduced: 400,
  ringDraw: 900,
  flip: 700,
  stagger: 50,
  shake: 50,
  toast: 1200,
  shimmer: 1200,
  sweep: 1400,
  sweepRest: 3200,
  processingStep: 900,
  ripple: 800,
} as const;

export const distances = {
  pullToRefresh: 80,
  riseOffset: 12,
} as const;

export const scales = {
  press: 0.98,
  sheetBackground: 0.92,
} as const;
