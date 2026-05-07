import { expect } from 'chai';
import { decodeToBuffer } from '../convert';

import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import { imageExtract } from '../extract';
import * as fs from 'fs/promises';
import sharp from 'sharp';
describe('extract', () => {
  it('base', async () => {
    const buffer = await fs.readFile(
      path.join(process.cwd(), './packages/image/test/fixture/test.png'),
    );
    let result = await imageExtract(buffer, {
      left: 1,
      top: 1,
      width: 5,
      height: 5,
    });
    let meatadata = await sharp(result).metadata();
    expect(meatadata.height).eq(5);
    expect(meatadata.width).eq(5);
  });
});
