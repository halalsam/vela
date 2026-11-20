import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const brandRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(brandRoot, '../..');
const logoDir = join(brandRoot, 'logo');
const iconsDir = join(logoDir, 'icons');
const fontsDir = join(brandRoot, 'fonts');
const mobileOut = join(repoRoot, 'apps/mobile/assets/brand');
const webOut = join(repoRoot, 'apps/web/public');
const widgetOut = join(repoRoot, 'apps/mobile/targets/widget/assets');

const MATTE_BLACK = '#0A0A0A';

const masters = {
  symbol: 'vela-symbol-white.svg',
  symbolSmall: 'vela-symbol-small-white.svg',
  wordmark: 'vela-wordmark-white.svg',
  horizontal: 'vela-horizontal-white.svg',
  stacked: 'vela-stacked-white.svg',
};

function parseMaster(svg, file) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error(`No viewBox in ${file}`);
  if (/transform=/.test(svg)) throw new Error(`Unexpected transform in ${file}`);
  const [minX, minY, width, height] = viewBox.split(/\s+/).map(Number);
  const paths = [...svg.matchAll(/<path\b([^>]*)\/?>/g)].map(([, attrs]) => {
    const d = attrs.match(/\sd="([^"]+)"/)?.[1];
    if (!d) throw new Error(`Path without d in ${file}`);
    const fillRule = attrs.match(/fill-rule="([^"]+)"/)?.[1] ?? 'nonzero';
    return { d, fillRule };
  });
  if (paths.length === 0) throw new Error(`No paths in ${file}`);
  return { minX, minY, width, height, paths };
}

async function writeGeometry() {
  const entries = {};
  for (const [name, file] of Object.entries(masters)) {
    entries[name] = parseMaster(await readFile(join(logoDir, file), 'utf8'), file);
  }
  const source = `export const markGeometry = ${JSON.stringify(entries, null, 2)} as const;\n\nexport type MarkName = keyof typeof markGeometry;\n`;
  await writeFile(join(brandRoot, 'src/geometry.generated.ts'), source);
}

async function svgToPng(svgPath, width, outPath) {
  const svg = await readFile(svgPath);
  await sharp(svg, { density: 1200 }).resize({ width }).png().toFile(outPath);
}

async function buildMobile() {
  await mkdir(mobileOut, { recursive: true });
  const copies = [
    ['ios/vela-ios-light-1024.png', 'icon.png'],
    ['ios/vela-ios-dark-1024.png', 'icon-ios-dark.png'],
    ['ios/vela-ios-tinted-1024.png', 'icon-ios-tinted.png'],
    ['android/ic_launcher_foreground.png', 'adaptive-foreground.png'],
    ['android/ic_launcher_background.png', 'adaptive-background.png'],
    ['android/ic_launcher_monochrome.png', 'adaptive-monochrome.png'],
  ];
  for (const [from, to] of copies) {
    await copyFile(join(iconsDir, from), join(mobileOut, to));
  }
  await svgToPng(join(logoDir, 'vela-symbol-white.svg'), 512, join(mobileOut, 'splash-icon.png'));
}

async function buildWidget() {
  await mkdir(widgetOut, { recursive: true });
  await svgToPng(join(logoDir, 'vela-symbol-white.svg'), 168, join(widgetOut, 'vela-symbol.png'));
  await svgToPng(join(logoDir, 'vela-symbol-small-white.svg'), 66, join(widgetOut, 'vela-symbol-small.png'));
  await copyFile(join(iconsDir, 'ios/vela-ios-light-1024.png'), join(widgetOut, 'icon.png'));
}

async function buildOgImage(outPath) {
  const width = 1200;
  const height = 630;
  const lockupWidth = 560;
  const lockup = await sharp(await readFile(join(logoDir, 'vela-horizontal-white.svg')), { density: 1200 })
    .resize({ width: lockupWidth })
    .png()
    .toBuffer();
  const { height: lockupHeight = 0 } = await sharp(lockup).metadata();
  await sharp({ create: { width, height, channels: 4, background: MATTE_BLACK } })
    .composite([
      {
        input: lockup,
        left: Math.round((width - lockupWidth) / 2),
        top: Math.round((height - lockupHeight) / 2),
      },
    ])
    .png()
    .toFile(outPath);
}

async function buildWeb() {
  await mkdir(join(webOut, 'fonts'), { recursive: true });
  const copies = [
    'favicon.svg',
    'favicon.ico',
    'favicon-16.png',
    'favicon-32.png',
    'favicon-48.png',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'maskable-512.png',
  ];
  for (const file of copies) {
    await copyFile(join(iconsDir, 'web', file), join(webOut, file));
  }
  const manifest = {
    name: 'vela',
    short_name: 'vela',
    description: 'Travel eSIM data plans. Land connected.',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    theme_color: MATTE_BLACK,
    background_color: MATTE_BLACK,
    display: 'standalone',
  };
  await writeFile(join(webOut, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
  await buildOgImage(join(webOut, 'og.png'));
  for (const file of await readdir(fontsDir)) {
    if (file.endsWith('.ttf')) await copyFile(join(fontsDir, file), join(webOut, 'fonts', file));
  }
}

await writeGeometry();
await buildMobile();
await buildWeb();
await buildWidget();
console.log('Brand assets written to packages/brand/src, apps/mobile/assets/brand, apps/mobile/targets/widget/assets and apps/web/public');
