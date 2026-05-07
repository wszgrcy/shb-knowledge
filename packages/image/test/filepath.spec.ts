import { expect } from 'chai';
import { decodeToBuffer } from '../convert';

import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
describe('filePath', () => {
  it('base', async () => {
    const result = await decodeToBuffer(
      path.join(process.cwd(), './packages/image/test/fixture/test.png'),
    );
    const type = await fileTypeFromBuffer(result);
    expect(type?.mime).eq('image/png');
  });
});
