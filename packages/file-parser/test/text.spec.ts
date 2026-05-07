import { Injector, INJECTOR_SCOPE } from 'static-injector';
import { FileParserService } from '../file-parser.service';
import { path } from '@cyia/vfs2';
import * as fs from 'fs';
import { equal, ok } from 'assert';
describe('纯文本解析', () => {
  const cwd = process.cwd();
  const fixture = path.join(cwd, './packages/file-parser/test/fixture');
  const injector = Injector.create({
    providers: [{ provide: INJECTOR_SCOPE, useValue: 'root' }],
  });
  const instance = injector.get(FileParserService);
  it('utf8', async () => {
    const filePath = path.join(fixture, './utf8.txt');
    const data = await fs.promises.readFile(filePath);
    const result = await instance.parse(filePath, data);
    ok(result);
    equal(result.length, 1);
    ok(result[0].content.includes('中文测试内容'));
  });
  it('gbk', async () => {
    const filePath = path.join(fixture, './gbk.txt');
    const data = await fs.promises.readFile(filePath);

    const result = await instance.parse(filePath, data);
    ok(result);
    equal(result.length, 1);
    ok(result[0].content.includes('中文测试内容'));
  });
});
