import { decodeBmp } from './bmp-decode';
import { makeBitmapFile } from './bmp-encode';
import { ResAsset } from './res-file';
import { parseUint16LE, unpackByteArr } from './res-utils';

/**
 * On Bip screen, a sub pixel can only be either on or off.
 * Therefore, r, g, b are boolean, not a number
 */
export class BipColor {
  readonly r: boolean;
  readonly g: boolean;
  readonly b: boolean;
  readonly a: boolean;
  constructor(r: boolean, g: boolean, b: boolean, a: boolean) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
  toCSSColor() {
    return `rgb(${this.r ? 255 : 0} ${this.g ? 255 : 0} ${this.b ? 255 : 0})`;
  }
  toIntColor() {
    return {
      r: this.r ? 255 : 0,
      g: this.g ? 255 : 0,
      b: this.b ? 255 : 0,
      a: this.a ? 255 : 0,
    };
  }
  clone() {
    return new BipColor(this.r, this.g, this.b, this.a);
  }
}

/**
 * Represents a Bitmap for Bip.
 * NOTE: File structure is different from BMP format
 */
export class BipBitmap {
  data: BipColor[][] = [];
  height: number;
  width: number;
  transp: boolean;

  // magic value is "BMd" (not to be confused with "BMP")
  header: Uint8Array = new Uint8Array([66, 77, 100, 0]);

  /**
   * Make a BipBitmap from BMP file
   */
  static fromBMP(buf: Uint8Array): BipBitmap {
    const bm = new BipBitmap();
    const { width, height, data } = decodeBmp(buf);
    bm.height = height;
    bm.width = width;
    bm.transp = false; // TODO: fixme
    for (let ir = 0; ir < height; ir++) {
      const row: BipColor[] = [];
      for (let ic = 0; ic < width; ic++) {
        const color = new BipColor(
          data[ir * 4 * width + ic * 4 + 0] > 128,
          data[ir * 4 * width + ic * 4 + 1] > 128,
          data[ir * 4 * width + ic * 4 + 2] > 128,
          data[ir * 4 * width + ic * 4 + 3] > 128
        );
        row.push(color);
      }
      bm.data.push(row);
    }
    return bm;
  }

  constructor(asset?: ResAsset) {
    if (asset && asset.type() !== 'bm') {
      throw new Error(`Expected "bm" asset type, but got "${asset.type()}"`);
    }
    const buf = asset?.data ?? new Uint8Array(0x10);

    // parse metadata
    this.width = parseUint16LE(buf, 4);
    this.height = parseUint16LE(buf, 6);
    this.transp = parseUint16LE(buf, 0xe) > 0;
    const paletteLen = parseUint16LE(buf, 0xc);
    const stride = parseUint16LE(buf, 8);
    const bitDepth = parseUint16LE(buf, 0xa);

    // parse palette
    const palette: BipColor[] = [];
    for (let i = 0; i < paletteLen; i++) {
      const off = 0x10 + 4 * i;
      const color = new BipColor(
        buf[off + 0] > 128,
        buf[off + 1] > 128,
        buf[off + 2] > 128,
        buf[off + 3] > 128
      );
      palette.push(color);
    }

    // parse bitmap
    for (let ir = 0; ir < this.height; ir++) {
      const rowLen = Math.ceil((this.width * bitDepth) / 8);
      if (stride !== rowLen) {
        throw new Error(
          `stride (= ${stride}) is not equal to rowLen (= ${rowLen})`
        );
      }
      const begin = 0x10 + palette.length * 4;
      const off = begin + ir * rowLen;
      const rowData = buf.subarray(off, off + rowLen);
      const unpacked = unpackByteArr(rowData, bitDepth);

      // unpack row
      const row: BipColor[] = [];
      for (let ic = 0; ic < unpacked.byteLength; ic++) {
        const color = palette[unpacked[ic]];
        row.push(color.clone());
      }

      // save row
      this.data.push(row);
    }
  }

  toBMP(): Uint8Array {
    return makeBitmapFile(
      this.width,
      this.height,
      this.data.map((row) => row.map((c) => c.toIntColor()))
    );
  }

  pack(): Uint8Array {
    const buf = new Uint8Array();
    // TODO: implement this
    return buf;
  }
}
