import { StardictParseService } from './dict-format/stardict-parse.service';

import { DictInput, DictParseResult } from './type';
import { MdictParseService } from './dict-format/mdict-parse.service';

import { inject, Injector, RootStaticInjectOptions } from 'static-injector';

import fs from 'fs';

import { path } from '@cyia/vfs2';
import { YamlDictParseService } from './dict-format/yaml-parse.service';
import { LRUCache } from 'lru-cache';
import { DslParseService } from './dict-format/dsl/dsl-parse.service';

export class DictService extends RootStaticInjectOptions {
  #injector = inject(Injector);
  #cache = new LRUCache<string, DictParseResult>({
    max: 2,
    ttl: 120_000,
  });
  async getDictName(input: DictInput) {
    const dict = await this.#getDictResolve(input);
    return dict.info.name || dict.info.fileName!;
  }
  async #getDictResolve(input: DictInput) {
    if (this.#cache.has(input.filePath)) {
      return this.#cache.get(input.filePath)!;
    }
    const { filePath, type } = input;
    let result!: DictParseResult;
    if (type === 'stardict') {
      result = await this.#injector.get(StardictParseService).parse(filePath);
    } else if (type === 'mdict') {
      result = await this.#injector
        .get(MdictParseService)
        .parse(filePath, input as any);
    } else if (type === 'dsl') {
      result = await this.#injector.get(DslParseService).parse(filePath);
    } else if (type === 'yaml') {
      result = await this.#injector.get(YamlDictParseService).parse(filePath);
    } else {
      throw new Error(`没有找到${type}字典对应解析器`);
    }
    this.#cache.set(input.filePath, result);
    return result;
  }
  /**
   * 第一个需要修改为3个操作
   */
  // 这里顺序反了,应该调用base,让base分配
  async importDict(name: string, dir: string, input: DictInput) {
    const baseName = path.basename(
      input!.filePath,
      path.extname(input!.filePath),
    );
    /** 知识库保存的名字 */
    const result = await this.#getDictResolve(input);

    name ||= result.info.name || baseName;

    /** 知识库文件夹 */

    const assetFolder = path.join(dir, 'assets');
    // 先导入资源,然后再ocr
    if (result.afterSave) {
      await fs.promises.mkdir(assetFolder, {
        recursive: true,
      });
      // 如果要保存,那么文件名应该一定存在,否则就没法写入了
      await result.afterSave(assetFolder!);
    }
    // 准备导入
    return result.dataListGenerator();
  }
}
