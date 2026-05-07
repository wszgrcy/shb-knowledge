import {
  createRootInjector,
  Injector,
  INJECTOR_SCOPE,
  signal,
} from 'static-injector';
import { FileParserService } from '../file-parser.service';
import { path } from '@cyia/vfs2';
import * as fs from 'fs';
import { ok } from 'assert';
import { expect } from 'chai';
import { DocumentParserConfigToken, ImageParserToken } from '../const';
describe('pdf-image', () => {
  const cwd = process.cwd();
  const fixture = path.join(cwd, './packages/file-parser/test/fixture');
  const injector = createRootInjector({
    providers: [
      {
        provide: DocumentParserConfigToken,
        useValue: signal({ pdfAsImage: { enable: true } }),
      },
      {
        provide: ImageParserToken,
        useValue: async (filePath: string, prefix: string, image: Buffer) => {
          expect(typeof filePath).eq('string');
          expect(typeof prefix).eq('string');
          expect(image instanceof Buffer).ok;
          return { content: 'hello', parseTo: 'markdown' };
        },
      },
    ],
  });

  const instance = injector.get(FileParserService);
  it('main', async () => {
    const filePath = path.join(fixture, './test.pdf');
    const data = await fs.promises.readFile(filePath);
    const result = await instance.parse(filePath, data);
    ok(result);
    expect(result.length).eq(1);
    expect(result[0].title).eq('pdf-title1');
    expect(result[0].content).eq('hello');
    expect(result[0].parseTo).eq('markdown');
  });
  it('main-one', async () => {
    const filePath = path.join(fixture, './test.pdf');
    const data = await fs.promises.readFile(filePath);
    const result = await instance.parseOne(filePath, data);
    ok(result);
    expect(result.content).eq('hello');
    expect(result.parseTo).eq('markdown');
  });
});
