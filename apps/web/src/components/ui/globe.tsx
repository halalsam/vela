'use client';

import { useEffect, useRef } from 'react';
import createGlobe, { type COBEOptions } from 'cobe';
import { useMotionValue, useReducedMotion, useSpring } from 'motion/react';

import { cn } from '@/lib/type';

const MOVEMENT_DAMPING = 1400;

// Vela look: dark sphere, white land dots, champagne markers on the destinations we sell.
const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 1.2,
  mapSamples: 16000,
  mapBrightness: 6,
  baseColor: [0.3, 0.3, 0.3],
  markerColor: [200 / 255, 178 / 255, 133 / 255],
  glowColor: [0.16, 0.15, 0.13],
  markers: [
    { location: [25.2048, 55.2708], size: 0.08 }, // Dubai
    { location: [13.7563, 100.5018], size: 0.06 }, // Bangkok
    { location: [35.6762, 139.6503], size: 0.08 }, // Tokyo
    { location: [-8.4095, 115.1889], size: 0.05 }, // Bali
    { location: [1.3521, 103.8198], size: 0.05 }, // Singapore
    { location: [51.5072, -0.1276], size: 0.07 }, // London
    { location: [24.7136, 46.6753], size: 0.06 }, // Riyadh
    { location: [41.0082, 28.9784], size: 0.06 }, // Istanbul
    { location: [48.8566, 2.3522], size: 0.06 }, // Paris
    { location: [41.9028, 12.4964], size: 0.05 }, // Rome
    { location: [40.7128, -74.006], size: 0.07 }, // New York
    { location: [30.0444, 31.2357], size: 0.05 }, // Cairo
    { location: [3.2028, 73.2207], size: 0.04 }, // Maldives
  ],
};

export type GlobeMarker = { location: readonly [number, number]; size: number; color?: [number, number, number] };

const TAU = Math.PI * 2;
const RESTING_THETA = 0.3;
/** How far each frame moves toward its target (0 to 1). Higher is snappier. */
const EASE = 0.08;

/** cobe's camera angles that put a [lat, lng] point in the middle of the globe. Tilt is capped so far-north places stay readable. */
function locationToAngles([lat, lng]: readonly [number, number]): [number, number] {
  const phi = Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2);
  const theta = Math.max(-0.9, Math.min(0.9, (lat * Math.PI) / 180));
  return [phi, theta];
}

/** Shortest signed angle from `from` to `to`, so the globe never spins the long way round. */
function angleDelta(from: number, to: number) {
  return ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

export function Globe({
  className,
  config = GLOBE_CONFIG,
  markers,
  focus = null,
}: {
  className?: string;
  config?: COBEOptions;
  /** Pins to draw. Changing sizes animates them; keep the same order between renders for a smooth change. */
  markers?: GlobeMarker[];
  /** Turn to and hold this [lat, lng]. Null spins freely. */
  focus?: readonly [number, number] | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const thetaRef = useRef(RESTING_THETA);
  const widthRef = useRef(0);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const reduceMotion = useReducedMotion();
  const reduceRef = useRef(reduceMotion);

  // Targets live in refs so cobe's render loop reads the latest props without recreating the canvas.
  const targetMarkers = useRef<GlobeMarker[]>(markers ?? (config.markers as GlobeMarker[]));
  // Sizes as currently drawn; empty until the first frame, which starts each pin at its target size.
  const shownSizes = useRef<number[]>([]);
  const focusRef = useRef(focus);

  const r = useMotionValue(0);
  const rs = useSpring(r, {
    mass: 1,
    damping: 30,
    stiffness: 100,
  });

  useEffect(() => {
    const next = markers ?? (config.markers as GlobeMarker[]);
    // A different marker set can't be tweened index by index; start it from its own sizes.
    if (next.length !== targetMarkers.current.length) shownSizes.current = next.map((marker) => marker.size);
    targetMarkers.current = next;
  }, [markers, config.markers]);

  useEffect(() => {
    focusRef.current = focus;
    // Drop any drag offset so the focused place lands in the centre.
    if (focus) r.set(0);
  }, [focus, r]);

  useEffect(() => {
    reduceRef.current = reduceMotion;
  }, [reduceMotion]);

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value !== null ? 'grabbing' : 'grab';
    }
  };

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      r.set(r.get() + delta / MOVEMENT_DAMPING);
    }
  };

  useEffect(() => {
    const onResize = () => {
      if (canvasRef.current) {
        widthRef.current = canvasRef.current.offsetWidth;
      }
    };

    window.addEventListener('resize', onResize);
    onResize();

    const globe = createGlobe(canvasRef.current!, {
      ...config,
      markers: targetMarkers.current.map((marker) => ({ location: [...marker.location], size: marker.size, color: marker.color })),
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender: (state) => {
        const reduce = reduceRef.current;
        const step = reduce ? 1 : EASE;
        const target = focusRef.current;
        if (target) {
          const [phi, theta] = locationToAngles(target);
          phiRef.current += angleDelta(phiRef.current, phi) * step;
          thetaRef.current += (theta - thetaRef.current) * step;
        } else {
          // No auto-spin under reduced motion; dragging still works.
          if (!pointerInteracting.current && !reduce) phiRef.current += 0.005;
          thetaRef.current += (RESTING_THETA - thetaRef.current) * step;
        }
        state.phi = phiRef.current + rs.get();
        state.theta = thetaRef.current;

        const markerTargets = targetMarkers.current;
        const sizes = shownSizes.current;
        state.markers = markerTargets.map((marker, index) => {
          const current = sizes[index] ?? marker.size;
          const size = current + (marker.size - current) * (reduce ? 1 : 0.12);
          sizes[index] = size;
          return { location: [...marker.location], size, color: marker.color };
        });

        state.width = widthRef.current * 2;
        state.height = widthRef.current * 2;
      },
    });

    const reveal = setTimeout(() => {
      if (canvasRef.current) canvasRef.current.style.opacity = '1';
    }, 0);
    return () => {
      clearTimeout(reveal);
      globe.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, [rs, config]);

  return (
    <div className={cn('absolute inset-0 mx-auto aspect-square w-full max-w-[600px]', className)}>
      <canvas
        className={cn('size-full opacity-0 transition-opacity duration-500 [contain:layout_paint_size]')}
        ref={canvasRef}
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX;
          updatePointerInteraction(e.clientX);
        }}
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) => e.touches[0] && updateMovement(e.touches[0].clientX)}
      />
    </div>
  );
}
