# Amazfit Bip Tools (typescript)

Various functions to work with Amazfit Bip / BipOS.

Tools are written in typescript and are targeted to run on browser.

## Res pack / unpack

```ts
import { ResAsset, ResFile } from 'amazfit-bip-tools-ts';

(async () => {
  const res = await ResFile.fromURL('path/to/file.res');

  // basic
  res.header; // file header, an Uint8Array
  res.assets[0]; // the first ResAsset stored in the file
  res.assets[0].type(); // type of this ResAsset. for example, 'bm' for Bitmap, 'elf' for BipOS executable

  // modify an asset
  const newAsset = new ResAsset(myBuffer); // provided that you already have a buffer
  res.assets.push(newAsset);
  res.size(); // optionally, you can get the new size of the res without calling pack()
  const packedRes = res.pack(); // export to new .res file
})();
```

## Bitmap tools

TODO
