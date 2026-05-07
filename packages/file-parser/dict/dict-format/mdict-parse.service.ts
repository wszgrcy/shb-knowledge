import { AbstractDictParse } from '../type';
import { Mdict, PassCode } from '@cyia/mdict-reader';
import { existsSync } from 'fs';
import { RootStaticInjectOptions } from 'static-injector';
import { path, createNormalizeVfs } from '@cyia/vfs2';
export class MdictParseService
  extends RootStaticInjectOptions
  implements AbstractDictParse
{
  async parse(filePathList: string, options?: PassCode) {
    let passCode: PassCode | undefined;
    if (options?.regCode && options.userId) {
      passCode = options;
    }
    const filePath = filePathList;
    const fileName = path.basename(filePath, path.extname(filePath));
    const mdxFilePath = path.resolve(path.dirname(filePath), `${fileName}.mdx`);
    const mdxInstance = await Mdict.build(mdxFilePath, passCode);
    const mddFilePath = path.resolve(path.dirname(filePath), `${fileName}.mdd`);
    const dataInfo = mdxInstance.getDictInfo().mdx;
    return {
      // todo 其实还可以保存更多信息
      info: {
        name:
          dataInfo.Title === 'Title (No HTML code allowed)'
            ? fileName
            : dataInfo.Title,
        fileName: fileName,
      },
      dataListGenerator: () => this.wordListGenerator(mdxInstance),
      afterSave: async (assetFolder: string) => {
        // value$$.next({ message: `准备写入资源文件` });

        let pendList: Promise<{ name: string; message: string } | undefined>[] =
          [];
        let sum = 0;
        const waitingWrite = async () => {
          const result = (await Promise.all(pendList)).filter(Boolean);
          if (result.length) {
            throw new Error(
              result
                .map((item) => `文件[${item!.name}]写入失败,${item?.message}`)
                .join('\n'),
            );
          } else {
            sum += pendList.length;
            // value$$.next({ message: `已写入${sum}个文件` });
          }
          pendList = [];
        };
        if (existsSync(mddFilePath)) {
          const vfs = createNormalizeVfs({ dir: assetFolder });
          const mddInstance = await Mdict.build(mddFilePath, passCode);
          const wordGenerator = mddInstance.load();
          for await (const item of wordGenerator) {
            pendList.push(
              mddInstance.getMddAsset(item).then((buffer) =>
                vfs
                  .writeFile(path.join(assetFolder, item.word), buffer)
                  .then(() => undefined)
                  .catch((reason: any) => ({
                    name: item.word,
                    message: reason,
                  })),
              ),
            );

            if (pendList.length >= 20) {
              await waitingWrite();
            }
          }
          if (pendList.length) {
            await waitingWrite();
          }
          // value$$.next({ message: '资源写入完成' });
        }
      },
    };
  }

  async *wordListGenerator(mdxInstance: Mdict) {
    const list = mdxInstance.load();
    for await (const item of list) {
      const definition = ((await mdxInstance.getDefinition(item)) || '').trim();
      if (!definition) {
        continue;
      }
      yield {
        content: definition,
        word: item.word,
      };
    }
  }
}
