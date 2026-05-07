import { Injector, INJECTOR_SCOPE } from 'static-injector';
import { path } from '@cyia/vfs2';
import * as fs from 'fs';
import { equal, ok } from 'assert';
import { vlMarkdownParser } from '../../vl-parser/markdown.parser';
import { expect } from 'chai';
describe('vl-markdown', () => {
  const cwd = process.cwd();
  const fixture = path.join(cwd, './packages/file-parser/test/fixture');

  it('utf8', async () => {
    const filePath = path.join(fixture, './vl/markdown.md');
    const data = await fs.promises.readFile(filePath, { encoding: 'utf-8' });

    let result = await vlMarkdownParser(data, {
      imageGet: async (type, position) => {
        expect(type).eq('qwen3-vl');
        expect(typeof position[0] === 'number' && !Number.isNaN(position[0]))
          .ok;
        expect(typeof position[1] === 'number' && !Number.isNaN(position[1]))
          .ok;
        expect(typeof position[2] === 'number' && !Number.isNaN(position[2]))
          .ok;
        expect(typeof position[3] === 'number' && !Number.isNaN(position[3]))
          .ok;
        return { src: 'abc.png', title: 'abc' };
      },
    });
    expect(result).not.contain('Image (142, 98, 837, 856)');
    expect(result).contain('![');
    expect(result).contain('abc.png');
  });
});
