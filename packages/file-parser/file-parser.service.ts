import { fileTypeFromBuffer } from 'file-type';
import { inject, RootStaticInjectOptions } from 'static-injector';
import { path } from '@cyia/vfs2';
import { bufferDecodeToText as textParse } from './text-parser';
import { FileParser, FileParserToken } from './const';
import {
  DocumentFileParserService,
  FormatedData,
} from './document-file-parser.service';

export class FileParserService
  extends RootStaticInjectOptions
  implements FileParser
{
  priority: number = 0;
  #parserList = inject(FileParserToken, { optional: true })
    ?.slice()
    .sort((a, b) => a.priority - b.priority) ?? [
    inject(DocumentFileParserService),
  ];
  async parse(fileName: string, buffer: Uint8Array | ArrayBuffer) {
    const baseName = path.basename(fileName, path.extname(fileName));
    let type;
    try {
      type = await fileTypeFromBuffer(buffer);
    } catch (error) {
      throw new Error(`文件:[${fileName}]类型解析失败`, {
        cause: error,
      });
    }
    for (const item of this.#parserList) {
      const result = await item.parse(fileName, buffer, type);
      if (result) {
        return result;
      }
    }
    // 尝试以文本形式解析
    return [
      { title: baseName, content: textParse(new Uint8Array(buffer)) },
    ] as FormatedData[];
  }

  /** 用于支持工作流读文件 */
  parseOne(fileName: string, buffer: Uint8Array | ArrayBuffer) {
    return this.parse(fileName, buffer).then((list) => {
      return {
        content: list?.map((item) => item.content).join('\n'),
        parseTo: list[0].parseTo,
      };
    });
  }
}
