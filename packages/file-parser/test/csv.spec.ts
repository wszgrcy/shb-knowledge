import { Injector, INJECTOR_SCOPE } from 'static-injector';
import { FileParserService } from '../file-parser.service';
import { path } from '@cyia/vfs2';
import * as fs from 'fs';
import { equal, ok } from 'assert';
describe('csv', () => {
  const cwd = process.cwd();
  const fixture = path.join(cwd, './packages/file-parser/test/fixture');
  const injector = Injector.create({
    providers: [{ provide: INJECTOR_SCOPE, useValue: 'root' }],
  });
  const instance = injector.get(FileParserService);
  it('main', async () => {
    const filePath = path.join(fixture, './test.csv');
    const data = await fs.promises.readFile(filePath);
    const result = await instance.parse(filePath, data);
    ok(result);
    equal(result.length, 10);
    ok(result[0].content.includes('Name'));
    ok(result[0].content.includes('第一行'));
    ok(result[9].content.includes('最后一行'));
  });
});
