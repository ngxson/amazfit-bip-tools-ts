// adapted from https://github.com/LinusU/decode-bmp

import { parseUint16LE, parseUint32LE } from './res-utils';

function makeDivisibleByFour(input: number) {
  const rest = input % 4;
  return rest ? input + 4 - rest : input;
}

type Channel = 'BGRA' | 'A' | 'C' | 'R' | 'G' | 'B';

class Bitmap {
  data: Uint8Array;
  offset: number;
  format: Channel;
  size: number;
  stride: number;
  depth: number;
  constructor(
    data: Uint8Array,
    offset: number,
    {
      width,
      height,
      colorDepth,
      format,
    }: { width: number; height: number; colorDepth: number; format: Channel }
  ) {
    this.format = format;
    this.offset = offset;
    this.depth = colorDepth;
    this.stride = makeDivisibleByFour((width * this.depth) / 8);
    this.size = this.stride * height;
    this.data = data.slice(this.offset, this.offset + this.size);

    if (this.size !== this.data.byteLength) {
      throw new Error('Truncated bitmap data');
    }
  }

  get(x: number, y: number, channel: Channel) {
    const idx = this.format.indexOf(channel);

    if (this.depth === 1) {
      const slice = this.data[y * this.stride + ((x / 8) | 0)];
      const mask = 1 << (7 - (x % 8) * 1);

      return (slice & mask) >> (7 - (x % 8) * 1);
    }

    if (this.depth === 2) {
      const slice = this.data[y * this.stride + ((x / 4) | 0)];
      const mask = 3 << (6 - (x % 4) * 2);

      return (slice & mask) >>> (6 - (x % 4) * 2);
    }

    if (this.depth === 4) {
      const slice = this.data[y * this.stride + ((x / 2) | 0)];
      const mask = 15 << (4 - (x % 2) * 4);

      return (slice & mask) >>> (4 - (x % 2) * 4);
    }

    return this.data[y * this.stride + x * (this.depth / 8) + idx];
  }
}

function decodeTrueColorBmp(
  data: Uint8Array,
  {
    width,
    height,
    colorDepth,
    icon,
  }: { width: number; height: number; colorDepth: number; icon: boolean }
) {
  if (colorDepth !== 32 && colorDepth !== 24) {
    throw new Error(`A color depth of ${colorDepth} is not supported`);
  }

  const xor = new Bitmap(data, 0, {
    width,
    height,
    colorDepth,
    format: 'BGRA',
  });
  const and =
    colorDepth === 24 && icon
      ? new Bitmap(data, xor.offset + xor.size, {
          width,
          height,
          colorDepth: 1,
          format: 'A',
        })
      : null;

  const result = new Uint8Array(width * height * 4);

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      result[idx++] = xor.get(x, height - y - 1, 'R');
      result[idx++] = xor.get(x, height - y - 1, 'G');
      result[idx++] = xor.get(x, height - y - 1, 'B');

      if (colorDepth === 32) {
        result[idx++] = xor.get(x, height - y - 1, 'A');
      } else {
        result[idx++] = and && and.get(x, height - y - 1, 'A') ? 0 : 255;
      }
    }
  }

  return new Uint8ClampedArray(
    result.buffer,
    result.byteOffset,
    result.byteLength
  );
}

function decodePaletteBmp(
  data: Uint8Array,
  {
    width,
    height,
    colorDepth,
    colorCount,
    icon,
  }: {
    width: number;
    height: number;
    colorDepth: number;
    colorCount: number;
    icon: boolean;
  }
) {
  if (
    colorDepth !== 8 &&
    colorDepth !== 4 &&
    colorDepth !== 2 &&
    colorDepth !== 1
  ) {
    throw new Error(`A color depth of ${colorDepth} is not supported`);
  }

  const colors = new Bitmap(data, 0, {
    width: colorCount,
    height: 1,
    colorDepth: 32,
    format: 'BGRA',
  });
  const xor = new Bitmap(data, colors.offset + colors.size, {
    width,
    height,
    colorDepth,
    format: 'C',
  });
  const and = icon
    ? new Bitmap(data, xor.offset + xor.size, {
        width,
        height,
        colorDepth: 1,
        format: 'A',
      })
    : null;

  const result = new Uint8Array(width * height * 4);

  let idx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colorIndex = xor.get(x, height - y - 1, 'C');

      result[idx++] = colors.get(colorIndex, 0, 'R');
      result[idx++] = colors.get(colorIndex, 0, 'G');
      result[idx++] = colors.get(colorIndex, 0, 'B');
      result[idx++] = and && and.get(x, height - y - 1, 'A') ? 0 : 255;
    }
  }

  return new Uint8ClampedArray(
    result.buffer,
    result.byteOffset,
    result.byteLength
  );
}

function checkMagicBytes(bytes: number) {
  if (bytes !== 0x4d42)
    throw new Error(`Invalid magic byte 0x${bytes.toString(16)}`);
}

export function decodeBmp(
  source: Uint8Array,
  { width: iconWidth = 0, height: iconHeight = 0, icon = false } = {}
) {
  const data = new Uint8Array(source);

  let headerSize;
  let bitmapWidth;
  let bitmapHeight;
  let colorDepth;
  let colorCount;

  if (icon) {
    headerSize = parseUint32LE(data, 0);
    bitmapWidth = (parseUint32LE(data, 4) / 1) | 0;
    bitmapHeight = (parseUint32LE(data, 8) / 2) | 0;
    colorDepth = parseUint16LE(data, 14);
    colorCount = parseUint32LE(data, 32);
  } else {
    checkMagicBytes(parseUint16LE(data, 0));
    headerSize = 14 + parseUint32LE(data, 14);
    bitmapWidth = parseUint32LE(data, 18);
    bitmapHeight = parseUint32LE(data, 22);
    colorDepth = parseUint16LE(data, 28);
    colorCount = parseUint32LE(data, 46);
  }

  if (colorCount === 0 && colorDepth <= 8) {
    colorCount = 1 << colorDepth;
  }

  const width = bitmapWidth === 0 ? iconWidth : bitmapWidth;
  const height = bitmapHeight === 0 ? iconHeight : bitmapHeight;

  const bitmapData = new Uint8Array(
    data.buffer,
    data.byteOffset + headerSize,
    data.byteLength - headerSize
  );

  const result = colorCount
    ? decodePaletteBmp(bitmapData, {
        width,
        height,
        colorDepth,
        colorCount,
        icon,
      })
    : decodeTrueColorBmp(bitmapData, { width, height, colorDepth, icon });

  return {
    width,
    height,
    data: result,
    colorDepth,
  };
}
