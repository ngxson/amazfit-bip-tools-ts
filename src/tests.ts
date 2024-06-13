import { BipBitmap, BipColor } from './bip-bitmap';
import { makeBitmapFile } from './bmp-encode';

function asset(condition: boolean) {
  if (!condition) {
    throw new Error('assert failed');
  }
}

function testBmp() {
  // generate random bmp
  const height = 100;
  const width = 200;
  const data: BipColor[][] = [];
  for (let ir = 0; ir < height; ir++) {
    const row: BipColor[] = [];
    for (let ic = 0; ic < width; ic++) {
      row.push(
        new BipColor(
          Math.random() > 0.5,
          Math.random() > 0.5,
          Math.random() > 0.5,
          false // no transparency
        )
      );
    }
    data.push(row);
  }

  const bmpFile = makeBitmapFile(
    width,
    height,
    data.map((row) => row.map((c) => c.toIntColor()))
  );
  const bm = BipBitmap.fromBMP(bmpFile);

  asset(bm.height === height);
  asset(bm.width === width);
  for (let ir = 0; ir < height; ir++) {
    for (let ic = 0; ic < width; ic++) {
      const c0 = data[ir][ic];
      const c1 = bm.data[ir][ic];
      asset(c0.r === c1.r);
      asset(c0.g === c1.g);
      asset(c0.b === c1.b);
      //asset(c0.a === c1.a);
    }
  }
}

testBmp();
