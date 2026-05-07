import {
  createInjector,
  inject,
  Injector,
  RootStaticInjectOptions,
} from 'static-injector';
import {
  ImportList,
  KnowledgeCollectionInput,
  KnowledgeConfig,
  KnowledgeType,
} from './type';
import {
  ConfigToken,
  getActivateCollectionName,
  getGraphCollectionName,
} from './const';
import { DictKnowledgeService } from './dict/dict.knowledge.service';
import { GraphKnolwdgeService } from './graph/graph.knowledge.service';
import type { Provider, R3Injector, Signal } from 'static-injector';
import { DictInput, FileParserService } from '@shenghuabi/knowledge/file-parser';
import { GraphHandleService } from './graph/graph.handle.service';
import { NormalKnowledgeService } from './normal/normal.knowledge.service';
import { GraphService } from './graph/graph.service';
import { GraphLocalService } from './graph/graph.local.service';
import { GraphKnowledgeUtilService } from './graph/graph.util.service';
import * as fs from 'fs/promises';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import { ArticleKnowledgeService } from './article';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { LogToken } from '@shenghuabi/knowledge/util';

export class KnowledgeManagerService extends RootStaticInjectOptions {
  #injector = inject(Injector);
  #fileParser = inject(FileParserService);

  #cacheMap = new Map<string, R3Injector>();
  #qdClient = inject(QdrantClientService);
  async getConfig(name: string): Promise<Signal<KnowledgeConfig>> {
    throw new Error('未实现');
  }

  protected async getInjector(name: string, extraProviders?: Provider[]) {
    let injector = this.#cacheMap.get(name);
    if (!injector) {
      const config = await this.getConfig(name);
      const CommonProviders: Array<Provider> = [
        { provide: ConfigToken, useValue: config },
        ...(extraProviders ?? []),
      ];
      switch (config().type) {
        case 'normal':
          injector = createInjector({
            providers: [NormalKnowledgeService, ...CommonProviders],
            parent: this.#injector,
          });
          break;
        case 'article':
          injector = createInjector({
            providers: [ArticleKnowledgeService, ...CommonProviders],
            parent: this.#injector,
          });
          break;
        case 'dict':
          injector = createInjector({
            providers: [DictKnowledgeService, ...CommonProviders],
            parent: this.#injector,
          });
          break;
        case 'normal-graph':
          injector = createInjector({
            providers: [
              GraphKnolwdgeService,
              GraphLocalService,
              GraphHandleService,
              GraphService,
              GraphKnowledgeUtilService,
              ...CommonProviders,
            ],
            parent: this.#injector,
          });
          break;
        default:
          throw '';
      }
      this.#cacheMap.set(name, injector);
    }
    return injector;
  }
  async #get(name: string) {
    const injector = await this.getInjector(name);
    const config = injector.get(ConfigToken);
    switch (config().type) {
      case 'normal':
        return injector.get(NormalKnowledgeService);
      case 'dict':
        return injector.get(DictKnowledgeService);
      case 'normal-graph':
        return injector.get(GraphKnolwdgeService);
      case 'article':
        return injector.get(ArticleKnowledgeService);
      default:
        throw new Error('');
    }
  }

  async create(name: string, collection: KnowledgeCollectionInput) {
    const instance = await this.#get(name);
    await instance.create(instance.formatCollection(collection));
  }
  /** 普通知识库和图谱知识库用 */
  async importFiles(
    name: string,
    filePathList: string[],
    signal?: AbortSignal,
  ) {
    const injector = await this.getInjector(name);
    const logService = injector.get(LogToken);
    const instance = (await this.#get(name)) as
      | NormalKnowledgeService
      | GraphKnolwdgeService;
    for (const filePath of filePathList) {
      if (signal?.aborted) {
        return;
      }
      const content = await fs.readFile(filePath);
      const list = await this.#fileParser.parse(filePath, content);
      for (const item of list) {
        if (signal?.aborted) {
          return;
        }
        logService.info(`正在导入 ${filePath}/${item.title}`);
        const content = item.content.trim();
        if (content) {
          await instance.insertItem(item.title, content, signal);
        } else {
          logService.warn(`内容为空 ${filePath}/${item.title}`);
        }
      }
    }
  }
  /** 字典专用 */
  async importDict(name: string, input: DictInput) {
    const instance = (await this.#get(name)) as DictKnowledgeService;
    return await instance.importDict(input);
  }
  async get(name: string) {
    return (await this.#get(name)) as
      | DictKnowledgeService
      | NormalKnowledgeService
      | GraphKnolwdgeService
      | ArticleKnowledgeService;
  }

  async importTextFile(
    name: string,
    dir: string,
    filePathList: string[],
    signal?: AbortSignal,
  ) {
    const injector = await this.getInjector(name);
    const logService = injector.get(LogToken);
    // 文件列表应该是相对的,需要工作空间的dir
    const instance = (await this.#get(name)) as ArticleKnowledgeService;
    for (const filePath of filePathList) {
      if (signal?.aborted) {
        return;
      }
      logService.info(`正在导入 ${filePath}`);
      const buffer = await fs.readFile(path.join(dir, filePath));
      const type = await fileTypeFromBuffer(buffer);
      if (type) {
        continue;
      }
      let content;
      try {
        content = buffer.toString();
      } catch (error) {
        continue;
      }
      await instance.insertItem(filePath, content);
    }
  }
  async deleteItem(name: string, fileName: string) {
    const instance = (await this.#get(name)) as
      | NormalKnowledgeService
      | GraphKnolwdgeService;
    await instance.deleteItem(fileName);
  }
  async updateItem(name: string, fileName: string, content: string) {
    const instance = (await this.#get(name)) as
      | NormalKnowledgeService
      | GraphKnolwdgeService;
    await instance.updateItem(fileName, content);
  }
  /** 通用接口 */
  async addCollection(name: string, collection: KnowledgeCollectionInput) {
    const instance = await this.#get(name);
    await instance.addCollection(instance.formatCollection(collection));
  }
  /** 通用接口 */
  async deleteCollection(name: string, collectionName: string) {
    const instance = await this.#get(name);
    return await instance.deleteCollection(collectionName);
  }
  async changeActivateCollection(name: string, collectionName: string) {
    const instance = await this.#get(name);
    await instance.changeActivateCollection(collectionName);
  }
  async destroy(name: string) {
    const instance = await this.#get(name);
    this.#cacheMap.delete(name);
    await instance.destroy();
  }
  async export(name: string) {
    const instance = await this.#get(name);
    return await instance.export();
  }
  async import(
    name: string,
    options: {
      snapshotList: ImportList;
      activateCollection: string;
      type: KnowledgeType;
    },
  ) {
    const logService = (await this.getInjector(name)).get(LogToken);
    for (const item of options.snapshotList) {
      logService.info(`正在导入 ${item.collection}`);
      await this.#qdClient.recoverSnapshot(item.collection, {
        location: item.filePath,
        priority: 'no_sync',
        checksum: item.checksum,
      });
    }
    await this.#qdClient.setActivateCollection(
      options.activateCollection,
      getActivateCollectionName(name),
    );
    if (options.type === 'normal-graph') {
      await this.#qdClient.setActivateCollection(
        getGraphCollectionName(options.activateCollection),
        getActivateCollectionName(getGraphCollectionName(name)),
      );
    }
  }
  async getGraph(name: string) {
    const injector = await this.getInjector(name);
    return injector.get(GraphService);
  }
}
