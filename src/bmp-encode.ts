interface Pixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function makeBitmapFile(
  width: number,
  height: number,
  data: Pixel[][]
): Uint8Array {
  // const isSameColor = (p1: Pixel, p2: Pixel) => p1.r === p2.r && p1.g === p2.g && p1.b === p2.b && p1.a === p2.a;

  // Detect color palette and bit depth
  const colorMap = new Map<string, number>();
  const colors: Pixel[] = [];

  data.forEach((row) =>
    row.forEach((pixel) => {
      const key = `${pixel.r},${pixel.g},${pixel.b},${pixel.a}`;
      if (!colorMap.has(key)) {
        colorMap.set(key, colors.length);
        colors.push(pixel);
      }
    })
  );

  let bitDepth: number;
  if (colors.length <= 2) {
    bitDepth = 1;
  } else if (colors.length <= 16) {
    bitDepth = 4;
  } else if (colors.length <= 256) {
    bitDepth = 8;
  } else {
    bitDepth = 24;
  }

  // BMP headers
  const fileHeaderSize = 14;
  const dibHeaderSize = 40;
  const colorPaletteSize = bitDepth <= 8 ? colors.length * 4 : 0;
  const dataOffset = fileHeaderSize + dibHeaderSize + colorPaletteSize;
  const rowSize = Math.floor((bitDepth * width + 31) / 32) * 4;
  const imageSize = rowSize * height;
  const fileSize = dataOffset + imageSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  let offset = 0;

  // File Header
  view.setUint16(offset, 0x4d42, true);
  offset += 2; // Signature 'BM'
  view.setUint32(offset, fileSize, true);
  offset += 4; // File size
  view.setUint32(offset, 0, true);
  offset += 4; // Reserved
  view.setUint32(offset, dataOffset, true);
  offset += 4; // Data offset

  // DIB Header
  view.setUint32(offset, dibHeaderSize, true);
  offset += 4; // DIB header size
  view.setInt32(offset, width, true);
  offset += 4; // Width
  view.setInt32(offset, height, true);
  offset += 4; // Height
  view.setUint16(offset, 1, true);
  offset += 2; // Planes
  view.setUint16(offset, bitDepth, true);
  offset += 2; // Bit count
  view.setUint32(offset, 0, true);
  offset += 4; // Compression
  view.setUint32(offset, imageSize, true);
  offset += 4; // Image size
  view.setInt32(offset, 0, true);
  offset += 4; // X pixels per meter
  view.setInt32(offset, 0, true);
  offset += 4; // Y pixels per meter
  view.setUint32(offset, colorMap.size, true);
  offset += 4; // Total colors
  view.setUint32(offset, colorMap.size, true);
  offset += 4; // Important colors

  // Color Palette
  if (bitDepth <= 8) {
    colors.forEach((color) => {
      view.setUint8(offset, color.b);
      offset++;
      view.setUint8(offset, color.g);
      offset++;
      view.setUint8(offset, color.r);
      offset++;
      view.setUint8(offset, 0);
      offset++;
    });
  }

  // Pixel Array
  const getColorIndex = (pixel: Pixel) =>
    colorMap.get(`${pixel.r},${pixel.g},${pixel.b},${pixel.a}`) || 0;

  const pixelsPerByte = 8 / bitDepth; // How many pixels fit in one byte
  const mask = (1 << bitDepth) - 1; // Mask to isolate pixel bits

  for (let y = 0; y < height; y++) {
    let rowOffset = offset;
    let byteAccumulator = 0;
    let bitPos = 0;

    for (let x = 0; x < width; x++) {
      const pixel = data[height - y - 1][x]; // Traverse from top to bottom
      const index = getColorIndex(pixel);

      byteAccumulator |=
        (index & mask) <<
        ((pixelsPerByte - 1 - (x % pixelsPerByte)) * bitDepth);
      bitPos += bitDepth;

      if (x % pixelsPerByte === pixelsPerByte - 1 || x === width - 1) {
        view.setUint8(rowOffset++, byteAccumulator);
        byteAccumulator = 0;
        bitPos = 0;
      }
    }

    offset += rowSize;
  }

  return new Uint8Array(buffer);
}

// Example usage:
// const data: Pixel[][] = ...;
// const bmpData = makeBitmapFile(100, 100, data);
// console.log(bmpData);
