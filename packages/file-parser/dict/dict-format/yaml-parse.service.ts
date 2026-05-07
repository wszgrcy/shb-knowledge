import { path } from '@cyia/vfs2';
import { AbstractDictParse } from '../type';
import * as fs from 'fs/promises';
import { parse } from 'yaml';
import { RootStaticInjectOptions } from 'static-injector';
import * as v from 'valibot';
export const YamlDefine = v.object({
  list: v.array(
    v.object({
      word: v.string(),
      content: v.string(),
      extra: v.optional(v.record(v.string(), v.any())),
    }),
  ),
});
export class YamlDictParseService
  extends RootStaticInjectOptions
  implements AbstractDictParse
{
  async parse(filePathList: string) {
    const filePath = filePathList;
    const ext = path.extname(filePath);
    const content = await fs.readFile(filePath, { encoding: 'utf-8' });
    const data = v.parse(YamlDefine, parse(content));
    return {
      info: {
        fileName: path.basename(filePath),
        name: path.basename(filePath, ext),
      },
      dataListGenerator: async function* () {
        for (const item of data.list) {
          yield item;
        }
      },
    };
  }
}
