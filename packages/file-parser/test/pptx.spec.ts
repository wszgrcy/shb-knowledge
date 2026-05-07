import { Injector, INJECTOR_SCOPE } from 'static-injector';
import { FileParserService } from '../file-parser.service';
import { path } from '@cyia/vfs2';
import * as fs from 'fs';
import { equal, ok } from 'assert';
describe('pptx', () => {
  const cwd = process.cwd();
  const fixture = path.join(cwd, './packages/file-parser/test/fixture');
  const injector = Injector.create({
    providers: [{ provide: INJECTOR_SCOPE, useValue: 'root' }],
  });
  const instance = injector.get(FileParserService);
  it('基础', async () => {
    const filePath = path.join(fixture, './test.pptx');
    const data = await fs.promises.readFile(filePath);
    const result = await instance.parse(filePath, data);
    ok(result);
    equal(result.length, 1);
    ok(result[0].content.includes('第一页'));
    ok(result[0].content.includes('第二页'));
  });
  it('带图片', async () => {
    const filePath = path.join(fixture, './test-jpg.pptx');
    const data = await fs.promises.readFile(filePath);
    const result = await instance.parse(filePath, data);
    ok(result);
    equal(result.length, 1);
    ok(result[0].content.includes('第一页'));
    ok(result[0].content.includes('第二页'));
  });
});
