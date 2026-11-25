'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/type';

// A dotted land globe drawn on a 2D canvas. Land comes from /geo/globe-dots.json (scripts/generate-globe-dots.mjs),
// one dot per ~1.5 degrees, each tagged with a catalog continent. With `continent` set, the globe turns to `focus`
// and that continent's land turns champagne while the rest dims. With none, it spins and all land is white.

type Pin = { location: readonly [number, number]; active: boolean };
type DotData = { continents: string[]; dots: number[] };

type Props = {
  /** Catalog continent to light up, or null for none. */
  continent: string | null;
  /** [lat, lng] to turn to. Null lets the globe spin. */
  focus: readonly [number, number] | null;
  /** Destinations we sell. Active ones are drawn as champagne pins. */
  pins: Pin[];
  className?: string;
};

const CHAMPAGNE = [200, 178, 133] as const;
const WHITE = [255, 255, 255] as const;
const RESTING_TILT = 0.35;
const SPIN = 0.0025; // radians per frame on "All"
const EASE = 0.07; // share of the remaining turn covered each frame
const DEPTH_BANDS = 4; // dots are batched by depth so one fill call covers many dots

let dotsPromise: Promise<DotData> | null = null;
function loadDots() {
  dotsPromise ??= fetch('/geo/globe-dots.json').then((response) => {
    if (!response.ok) throw new Error(`globe dots: ${response.status}`);
    return response.json() as Promise<DotData>;
  });
  return dotsPromise;
}

const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const wrap = (angle: number) => ((((angle + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
const mix = (a: readonly number[], b: readonly number[], t: number) =>
  a.map((value, index) => Math.round(value + ((b[index] ?? value) - value) * t));

export function DottedGlobe({ continent, focus, pins, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Everything the frame loop reads lives in refs, so prop changes never restart the loop.
  const target = useRef({ continent, focus, pins });
  useEffect(() => {
    target.current = { continent, focus, pins };
  }, [continent, focus, pins]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let data: { lat: Float32Array; lng: Float32Array; group: Uint8Array; names: string[] } | null = null;
    let weights: number[] = []; // per continent: 0 = plain, 1 = lit
    let rotation = 0; // longitude turn, radians
    let tilt = RESTING_TILT;
    let size = 0;
    let ratio = 1;
    let frame = 0;
    let visible = true;
    let drag: { x: number; rotation: number } | null = null;
    let cancelled = false;

    loadDots()
      .then((loaded) => {
        if (cancelled) return;
        const count = loaded.dots.length / 3;
        const lat = new Float32Array(count);
        const lng = new Float32Array(count);
        const group = new Uint8Array(count);
        for (let i = 0; i < count; i += 1) {
          lat[i] = toRad(loaded.dots[i * 3] ?? 0);
          lng[i] = toRad(loaded.dots[i * 3 + 1] ?? 0);
          group[i] = loaded.dots[i * 3 + 2] ?? 0;
        }
        data = { lat, lng, group, names: loaded.continents };
        weights = loaded.continents.map((name) => (name === target.current.continent ? 1 : 0));
        canvas.style.opacity = '1';
      })
      .catch(() => {
        // No dots: the sphere and pins still draw, just without land.
        canvas.style.opacity = '1';
      });

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      size = canvas.clientWidth;
      canvas.width = Math.round(size * ratio);
      canvas.height = Math.round(size * ratio);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    // Only animate while on screen.
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible && !frame) frame = requestAnimationFrame(draw);
    });
    intersection.observe(canvas);

    function project(lat: number, lng: number, radius: number, centre: number) {
      // Rotate around the poles, then tilt toward the viewer. Returns screen x, y and depth (>0 faces us).
      const cosLat = Math.cos(lat);
      const x = cosLat * Math.sin(lng + rotation);
      const y = Math.sin(lat);
      const z = cosLat * Math.cos(lng + rotation);
      const yTilted = y * Math.cos(tilt) - z * Math.sin(tilt);
      const depth = y * Math.sin(tilt) + z * Math.cos(tilt);
      return { x: centre + x * radius, y: centre - yTilted * radius, depth };
    }

    function draw() {
      frame = 0;
      if (!visible || !context || !canvas) return;
      const reduce = reduceQuery.matches;
      const step = reduce ? 1 : EASE;
      const { continent: lit, focus: aim, pins: pinList } = target.current;

      // Camera: ease toward the focus, or spin.
      if (aim) {
        if (!drag) rotation += wrap(-toRad(aim[1]) - rotation) * step;
        tilt += (Math.max(-0.9, Math.min(0.9, toRad(aim[0]))) - tilt) * step;
      } else {
        if (!drag && !reduce) rotation += SPIN;
        tilt += (RESTING_TILT - tilt) * step;
      }
      rotation = wrap(rotation);

      // Continent highlight fades in and out instead of switching.
      if (data)
        weights = data.names.map(
          (name, index) => (weights[index] ?? 0) + ((name === lit ? 1 : 0) - (weights[index] ?? 0)) * (reduce ? 1 : 0.1),
        );

      const pixels = size * ratio;
      const centre = pixels / 2;
      const radius = pixels * 0.46;
      context.clearRect(0, 0, pixels, pixels);

      // Sphere: soft warm glow behind, dark body, faint rim.
      const glow = context.createRadialGradient(centre, centre, radius * 0.9, centre, centre, radius * 1.08);
      glow.addColorStop(0, 'rgba(200,178,133,0.10)');
      glow.addColorStop(1, 'rgba(200,178,133,0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, pixels, pixels);
      const body = context.createRadialGradient(centre - radius * 0.35, centre - radius * 0.4, radius * 0.1, centre, centre, radius);
      body.addColorStop(0, '#1c1c1c');
      body.addColorStop(1, '#0e0e0e');
      context.beginPath();
      context.arc(centre, centre, radius, 0, Math.PI * 2);
      context.fillStyle = body;
      context.fill();
      context.lineWidth = ratio;
      context.strokeStyle = 'rgba(255,255,255,0.08)';
      context.stroke();

      // Land dots: one pass projects every dot into a path per continent and depth band, then each path fills once.
      if (data) {
        const anyLit = lit !== null;
        const dotRadius = Math.max(0.9, radius / 210);
        const paths = data.names.map(() => Array.from({ length: DEPTH_BANDS }, () => new Path2D()));
        const used = data.names.map(() => new Array<boolean>(DEPTH_BANDS).fill(false));
        for (let i = 0; i < data.group.length; i += 1) {
          const point = project(data.lat[i] ?? 0, data.lng[i] ?? 0, radius, centre);
          if (point.depth <= 0) continue;
          const group = data.group[i] ?? 0;
          const band = Math.min(DEPTH_BANDS - 1, Math.floor(point.depth * DEPTH_BANDS));
          const path = paths[group]?.[band];
          if (!path) continue;
          const r = dotRadius * (0.6 + 0.4 * point.depth);
          path.moveTo(point.x + r, point.y);
          path.arc(point.x, point.y, r, 0, Math.PI * 2);
          used[group]![band] = true;
        }
        for (let group = 0; group < data.names.length; group += 1) {
          const weight = weights[group] ?? 0;
          const colour = mix(WHITE, CHAMPAGNE, weight).join(',');
          const baseAlpha = anyLit ? 0.22 + 0.78 * weight : 0.85;
          for (let band = 0; band < DEPTH_BANDS; band += 1) {
            const path = paths[group]?.[band];
            if (!path || !used[group]?.[band]) continue;
            context.fillStyle = `rgba(${colour},${(baseAlpha * (0.35 + 0.65 * ((band + 0.5) / DEPTH_BANDS))).toFixed(3)})`;
            context.fill(path);
          }
        }
      }

      // Destination pins on top: a halo plus a solid centre. Inactive pins are hidden while a continent is lit.
      for (const pin of pinList) {
        if (lit !== null && !pin.active) continue;
        const point = project(toRad(pin.location[0]), toRad(pin.location[1]), radius, centre);
        if (point.depth <= 0.05) continue;
        const r = Math.max(2, radius / 70) * (lit !== null ? 1.3 : 1);
        context.beginPath();
        context.arc(point.x, point.y, r * 2.2, 0, Math.PI * 2);
        context.fillStyle = `rgba(200,178,133,${(0.22 * point.depth).toFixed(3)})`;
        context.fill();
        context.beginPath();
        context.arc(point.x, point.y, r, 0, Math.PI * 2);
        context.fillStyle = `rgba(200,178,133,${(0.6 + 0.4 * point.depth).toFixed(3)})`;
        context.fill();
        context.lineWidth = ratio;
        context.strokeStyle = 'rgba(10,10,10,0.9)';
        context.stroke();
      }

      frame = requestAnimationFrame(draw);
    }

    // Drag to turn. Pointer capture keeps the drag alive outside the canvas.
    const onDown = (event: PointerEvent) => {
      drag = { x: event.clientX, rotation };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onMove = (event: PointerEvent) => {
      if (!drag || !size) return;
      rotation = drag.rotation + ((event.clientX - drag.x) / size) * Math.PI;
    };
    const onUp = () => {
      drag = null;
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    frame = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn('aspect-square w-full cursor-grab touch-pan-y opacity-0 transition-opacity duration-slow ease-vela', className)}
    />
  );
}
