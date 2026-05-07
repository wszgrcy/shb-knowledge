import { Injector, INJECTOR_SCOPE } from 'static-injector';
import { FileParserService } from '../file-parser.service';
import { path } from '@cyia/vfs2';
import * as fs from 'fs';
import { equal, ok } from 'assert';
describe('pdf', () => {
  const cwd = process.cwd();
  const fixture = path.join(cwd, './packages/file-parser/test/fixture');
  const injector = Injector.create({
    providers: [{ provide: INJECTOR_SCOPE, useValue: 'root' }],
  });
  const instance = injector.get(FileParserService);
  it('基础', async () => {
    const filePath = path.join(fixture, './test.pdf');
    const data = await fs.promises.readFile(filePath);
    const result = await instance.parse(filePath, data);
    ok(result);
    equal(result.length, 1);
    ok(result[0].content.includes('Test-output'));
    ok(result[0].content.includes('Before'));
    ok(result[0].content.includes('After'));
  });
  it('带图片', async () => {
    const filePath = path.join(fixture, './test-jpg.pdf');
    const data = await fs.promises.readFile(filePath);
    const result = await instance.parse(filePath, data);
    ok(result);
    equal(result.length, 2);
    ok(result[0].content.includes('文件'));
    ok(result[0].content.includes('内容'));
    ok(result[0].content.includes('标题'));
    ok(result[0].content.endsWith('引用'));
    ok(result[1].content.endsWith('第二页'));
  });
});
