import { AbstractDictParse } from '../type';
import * as fs from 'fs/promises';
import * as zlib from 'zlib';
import * as util from 'util';
import { RootStaticInjectOptions } from 'static-injector';
import decompress from 'decompress';

import decompressTarbz from '@xhmikosr/decompress-tarbz2';
import { tmpdir } from 'os';
import { v4 } from 'uuid';
import { path } from '@cyia/vfs2';
import { decode } from 'html-entities';

const decoder = new util.TextDecoder('utf-8');
export class StardictParseService
  extends RootStaticInjectOptions
  implements AbstractDictParse
{
  async parse(filePathList: string) {
    const filePath = filePathList;
    let infoFileContent!: string;
    let indexFileBuffer!: Buffer;
    let dictFileBuffer!: Buffer;
    if (filePath.endsWith('tar.bz2')) {
      const dir = path.join(tmpdir(), v4());
      const list = await decompress(filePath, dir, {
        plugins: [decompressTarbz()],
      });
      for (const item of list) {
        if (item.path.endsWith('ifo')) {
          infoFileContent = item.data.toString();
        } else if (item.path.endsWith('idx')) {
          indexFileBuffer = item.data;
        } else if (item.path.endsWith('dict.dz')) {
          dictFileBuffer = item.data;
        }
      }
      if (!infoFileContent || !indexFileBuffer || !dictFileBuffer) {
        throw new Error(`解压后未找到指定内容,文件夹:${dir}`);
      }
    } else {
      const fileName = path.basename(filePath).replace(/\.(ifo|tar\.bz)$/, '');

      infoFileContent = (
        await fs.readFile(
          path.resolve(path.dirname(filePath), `${fileName}.ifo`),
        )
      ).toString();
      indexFileBuffer = await fs.readFile(
        path.resolve(path.dirname(filePath), `${fileName}.idx`),
      );
      dictFileBuffer = await fs.readFile(
        path.resolve(path.dirname(filePath), `${fileName}.dict.dz`),
      );
    }

    // let infoPath=fs.readFile()
    // 读取导入文件/文件夹
    //解析索引
    // 解压缩内容
    // 读取内容,并且进行一些格式化
    // 将列表返回(统一插入到数据库)
    const [info, list] = await Promise.all([
      this.#getInfo(infoFileContent).then((obj) => {
        obj['name'] ??= obj['bookname'];
        return obj;
      }),
      this.#getIndex(indexFileBuffer),
    ]);
    return {
      info: info as any,
      dataListGenerator: () => this.#getDict(dictFileBuffer, list),
    };
  }

  async #getInfo(content: string) {
    const list = content
      .split(/\r\n|\n\r|\n|\r/)
      .filter(Boolean)
      .map((item) => item.split('=').filter(Boolean))
      .filter((list) => list.length === 2);
    return list.reduce(
      (obj, item) => {
        obj[item[0]] = item[1];
        return obj;
      },
      {} as Record<string, string>,
    );
  }
  async #getIndex(buffer: Buffer) {
    const indexData: [string, number, number][] = [];
    let index = 0;
    while (index < buffer.length) {
      const beg = index;
      index = buffer.indexOf('\x00', beg);
      let word = buffer.toString('utf-8', beg, index);
      if (word.includes('&#')) {
        word = decode(word);
      }
      index++;
      const offset = buffer.readUInt32BE(index);
      index += 4;
      const size = buffer.readUInt32BE(index);
      index += 4;
      indexData.push([word, offset, size]);
    }
    return indexData;
  }
  async *#getDict(
    buffer: Buffer,
    indexData: readonly (readonly [string, number, number])[],
  ) {
    const rawdata = new Uint8Array(buffer);
    const buffer_1 = zlib.gunzipSync(rawdata);
    const rawdata_1 = new Uint8Array(buffer_1);
    for (const [word, offset, size] of indexData) {
      const chunk = rawdata_1.slice(offset, offset + size);
      const decoded = (decoder.decode(chunk) ?? '').trim();
      if (!decoded) {
        continue;
      }
      yield {
        word,
        content: decoded,
      };
    }
  }
}
