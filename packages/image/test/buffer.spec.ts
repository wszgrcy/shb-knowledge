import { expect } from 'chai';
import {
  bufferToImageBase64,
  convertToCompatibleBuffer,
  decodeToBuffer,
} from '../convert';

import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import * as fs from 'fs/promises';
describe('filePath', () => {
  it('base', async () => {
    const filePath = path.join(
      process.cwd(),
      './packages/image/test/fixture/test.png',
    );
    const content = await fs.readFile(filePath);
    const result = await decodeToBuffer(content);
    const type = await fileTypeFromBuffer(result);
    expect(type?.mime).eq('image/png');
  });
  it('兼容转换', async () => {
    const filePath = path.join(
      process.cwd(),
      './packages/image/test/fixture/test.png',
    );
    const content = await fs.readFile(filePath);
    const result = await convertToCompatibleBuffer(content);
    const base64 = bufferToImageBase64(result);
    const result2 = await decodeToBuffer(base64);
    const type = await fileTypeFromBuffer(result2);
    expect(type?.mime).eq('image/png');
  });
});
