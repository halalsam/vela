// Identifies an image from its first bytes and reads its size, without decoding it. The browser's content type is
// never trusted: only these formats are accepted, and SVG is refused because it can carry scripts.

export type ImageKind = { mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/avif'; ext: 'jpg' | 'png' | 'webp' | 'gif' | 'avif' };
export type ImageInfo = ImageKind & { width: number | null; height: number | null };

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u16le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, i: number) => (((b[i] ?? 0) << 24) >>> 0) + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0);

function jpegSize(b: Uint8Array): [number, number] | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
      i += marker === 0xff ? 1 : 2;
      continue;
    }
    // Start-of-frame markers carry the size; C4, C8 and CC are other tables.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [u16be(b, i + 7), u16be(b, i + 5)];
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function webpSize(b: Uint8Array): [number, number] | null {
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8 ') return [u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff];
  if (chunk === 'VP8L') {
    const b0 = b[21] ?? 0, b1 = b[22] ?? 0, b2 = b[23] ?? 0, b3 = b[24] ?? 0;
    return [1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))];
  }
  if (chunk === 'VP8X') return [1 + u24le(b, 24), 1 + u24le(b, 27)];
  return null;
}

function avifSize(b: Uint8Array): [number, number] | null {
  const limit = Math.min(b.length - 16, 4096);
  for (let i = 0; i < limit; i += 1) {
    if (b[i] === 0x69 && ascii(b, i, 4) === 'ispe') return [u32be(b, i + 8), u32be(b, i + 12)];
  }
  return null;
}

export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  let kind: ImageKind | null = null;
  let size: [number, number] | null = null;
  if (bytes.length < 16) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    kind = { mime: 'image/jpeg', ext: 'jpg' };
    size = jpegSize(bytes);
  } else if (ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') {
    kind = { mime: 'image/png', ext: 'png' };
    size = [u32be(bytes, 16), u32be(bytes, 20)];
  } else if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') {
    kind = { mime: 'image/gif', ext: 'gif' };
    size = [u16le(bytes, 6), u16le(bytes, 8)];
  } else if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    kind = { mime: 'image/webp', ext: 'webp' };
    size = webpSize(bytes);
  } else if (ascii(bytes, 4, 4) === 'ftyp' && ['avif', 'avis'].includes(ascii(bytes, 8, 4))) {
    kind = { mime: 'image/avif', ext: 'avif' };
    size = avifSize(bytes);
  }
  if (!kind) return null;
  const valid = size && size[0] > 0 && size[1] > 0 && size[0] < 100_000 && size[1] < 100_000;
  return { ...kind, width: valid ? size![0] : null, height: valid ? size![1] : null };
}

export const contentTypeForExt: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
