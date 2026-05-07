import fs from 'fs';
import chardet from 'chardet';
import { dslFormat } from './dsl.format';
import { RootStaticInjectOptions } from 'static-injector';
import { AbstractDictParse, DictParseResult } from '../../type';
import { PassCode } from '@cyia/mdict-reader';
import { basename } from 'path';
export class DslParseService
  extends RootStaticInjectOptions
  implements AbstractDictParse
{
  async parse(
    filePath: string,
    options?: Partial<PassCode>,
  ): Promise<DictParseResult> {
    const instance = new DslParse(filePath);
    await instance.init();
    return {
      info: {
        ...instance.info,
        name: instance.info['NAME'],
        fileName: basename(filePath, '.dsl'),
      },
      dataListGenerator: () => instance.generate(),
    };
  }
}
class DslParse {
  filePath;
  fileContent!: string;
  start = 0;

  info = {} as Record<string, any>;
  wordStart!: number;
  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async init() {
    const buffer = await fs.promises.readFile(this.filePath);
    const subBuf = new Uint8Array(buffer.subarray(0, 500));
    const a = chardet.detect(subBuf);
    this.fileContent = buffer.toString((a as any) ?? 'UTF-16LE').trimStart();
    while (this.readMetadata()) {}
    this.readEntry();
  }

  readMetadata() {
    const regexp =
      /^#(NAME|INDEX_LANGUAGE|CONTENTS_LANGUAGE|SOUND_DICTIONARY|SOURCE_CODE_PAGE)\s+(.+)/dgm;
    regexp.lastIndex = this.start;
    const result = regexp.exec(this.fileContent.trimStart());
    if (result) {
      try {
        this.info[result[1]] = JSON.parse(result[2]);
      } catch (error) {
        this.info[result[1]] = result[2];
      }
      this.start = result.indices![0][1];
      return true;
    }
    return false;
  }
  lastWordInfo?: { word: string; range: [number, number] };
  async *generate() {
    let result;
    while ((result = this.readEntry())) {
      yield result;
    }
  }
  readEntry() {
    const regexp = /^[^\s]+/dgm;
    regexp.lastIndex = this.start;
    const result = regexp.exec(this.fileContent);

    if (result) {
      this.start = result.indices![0][1];
      const lastWordInfo = this.lastWordInfo;
      this.lastWordInfo = {
        word: result[0],
        range: result.indices![0],
      };
      if (lastWordInfo) {
        const content = this.fileContent
          .slice(lastWordInfo.range[1], this.lastWordInfo!.range[0])
          .replace(/^\s+/gm, '');
        return {
          word: lastWordInfo.word,
          content: content,
          htmlContent: dslFormat(content),
        };
      }
    } else {
      if (this.lastWordInfo) {
        const content = this.fileContent
          .slice(this.lastWordInfo.range[1])
          .replace(/^\s+/gm, '');
        const result = {
          word: this.lastWordInfo.word,
          content: content,
          htmlContent: dslFormat(content),
        };
        this.lastWordInfo = undefined;
        return result;
      }
    }
    return undefined;
  }
}
