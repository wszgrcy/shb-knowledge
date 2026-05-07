import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { computed, inject, Signal } from 'static-injector';

import { createNormalizeVfs } from '@cyia/vfs2';
import { promise as fastq } from 'fastq';
import { getHash, isTruthy, runInEmbeddingContext } from '@shenghuabi/knowledge/util';
import { LogToken } from '@shenghuabi/knowledge/util';
import {
  Text2VecToken,
  TextSplitterToken,
  ConfigToken,
  DirToken,
} from '../const';
import { KnowledgeUtilService } from '../knowledge.util.service';
import { entryFormat } from '../template.format';
import {
  NormalCollectionDefine,
  NormalCollectionInlineType,
  NormalKnowledgeConfigInline,
} from './define/config';
import * as v from 'valibot';
import { FileChunkPayload } from '../common/define/chunk';
import { CommonKnowledgeService } from '../common/common.knowledge.service';

export class NormalKnowledgeService extends CommonKnowledgeService {
  #text2vec = inject(Text2VecToken);
  #textSplitter = inject(TextSplitterToken);
  #config = inject<Signal<NormalKnowledgeConfigInline>>(ConfigToken);
  #util = inject(KnowledgeUtilService);
  #qdClient = inject(QdrantClientService);
  #channel = inject(LogToken);
  #vfs = computed(() => createNormalizeVfs({ dir: this.#dir() }));
  #dir = inject(DirToken);
  protected KeyWordIndex = ['fileName'];
  protected getPayload(fileName: string, content: string): Record<string, any> {
    return { fileName: fileName };
  }
  formatCollection(input: any) {
    return v.parse(NormalCollectionDefine, input);
  }
  protected async createCollection(collection: NormalCollectionInlineType) {
    this.#channel.info(
      `创建集合:${this.#config().name};嵌入长度:${collection.size}`,
    );
    const { exists } = await this.#qdClient.collectionExists(
      collection.collectionName,
    );
    if (exists) {
      throw new Error(`集合${collection.collectionName}已存在`);
    }
    await this.#qdClient.createCollection(collection.collectionName, {
      vectors: {
        chunk: {
          size: collection.size,
          distance: 'Cosine',
          on_disk: true,
        },
      },
    });
    this.#channel.info(`创建索引`);
    for (const keyword of this.KeyWordIndex) {
      await this.#qdClient.createPayloadKeywordIndex(
        collection.collectionName,
        keyword,
      );
    }
  }
  /** 创建知识库 */
  async create(collection: NormalCollectionInlineType) {
    this.#channel.info(`准备创建知识库:${this.#config().name}`);
    await this.createCollection(collection);
    await this.#qdClient.setActivateCollection(
      collection.collectionName,
      this.#config().activateName,
    );
    this.#channel.info(`创建完成:${this.#config().name}`);
  }

  async insertItemOnly(
    fileName: string,
    content: string,
    collectionList: NormalCollectionInlineType[],
  ) {
    return await runInEmbeddingContext(
      (t2v) =>
        Promise.all(
          collectionList.map(async (collectionItem) => {
            const chunkList = (
              await this.#textSplitter(
                content,
                this.getPayload(fileName, content),
                collectionItem.collectionName,
              )
            ).filter((item) => !!item.pageContent.trim());
            if (!chunkList.length) {
              return;
            }
            const points = await Promise.all(
              chunkList.map(async (item) => {
                const pageContent = item.pageContent.trim();
                const id = getHash(pageContent);
                const payload = {
                  ...item.metadata,
                  chunk: pageContent,
                  hash: id,
                } as Record<string, any>;
                const embeddingChunk = entryFormat(
                  payload,
                  this.#config().name,
                  pageContent,
                  collectionItem.embeddingTemplate?.entry,
                );
                if (!embeddingChunk) {
                  this.#channel.warn(
                    `内容格式化后内容为空,跳过\n${JSON.stringify({ payload, knowledge: this.#config().name, pageContent })}`,
                  );
                  return;
                }
                payload['embeddingChunk'] = embeddingChunk;
                return {
                  id: id,
                  vector: {
                    chunk: await t2v(
                      embeddingChunk,
                      collectionItem.collectionName,
                    ),
                  },
                  payload: payload as FileChunkPayload,
                };
              }),
            ).then((list) => list.filter(isTruthy));
            if (points.length) {
              await this.#qdClient.upsert(collectionItem.collectionName, {
                wait: true,
                points: points,
              });
              return points;
            }
            return;
          }),
        ).then((list) => list.filter(isTruthy)),
      this.#text2vec,
    );
  }

  protected async _insertItem(fileName: string, content: string) {
    if (await this.#vfs().exists(fileName)) {
      return false;
    }
    await this.#vfs().writeFile(fileName, content);
    return await this.insertItemOnly(
      fileName,
      content,
      this.#config().collectionList,
    );
  }
  async insertItem(fileName: string, content: string, signal?: AbortSignal) {
    await this._insertItem(fileName, content);
  }
  async deleteItem(fileName: string) {
    await this.#util.multiDelete(
      this.#config().collectionList.map((item) => item.collectionName),
      {
        filter: {
          must: [{ key: 'fileName', match: { value: fileName } }],
          should: null,
        },
      },
    );
    await this.#vfs().delete(fileName, { force: true });
  }
  async updateItem(fileName: string, content: string) {
    await this.deleteItem(fileName);
    await this.insertItem(fileName, content);
  }

  async addCollection(collection: NormalCollectionInlineType) {
    /** 保存文件,新创建的没有 */

    const list = (await this.#vfs().exists(''))
      ? await this.#vfs().readdir('')
      : [];
    await this.createCollection(collection);
    const queue = fastq(async (fileName: string) => {
      const content = await this.#vfs().readContent(fileName);
      if (typeof content !== 'string' || !content) {
        return;
      }
      await this.insertItemOnly(fileName, content, [collection]);
    }, 20);
    let queueError;
    queue.error((error) => {
      if (error) {
        queueError = error;
        queue.killAndDrain();
      }
    });
    try {
      for (const item of list) {
        queue.push(item);
      }
      await queue.drained();
      if (queueError) {
        throw queueError;
      }
    } catch (error) {
      await this.#qdClient.deleteCollection(collection.collectionName);
      throw error;
    }

    await this.#qdClient.setActivateCollection(
      collection.collectionName,
      this.#config().activateName,
    );
  }
  // 激活collection不可删除,所以这里不应该有删除切换的问题
  async deleteCollection(collectionName: string) {
    const isActivate = this.#config().activateCollection === collectionName;
    if (isActivate) {
      return false;
    }
    const collection = this.#config().collectionList.find(
      (item) => item.collectionName === collectionName,
    )!;
    if (!collection) {
      return false;
    }
    await this.#qdClient.deleteCollection(collectionName);
    return true;
  }
  async changeActivateCollection(collectionName: string) {
    await this.#qdClient.setActivateCollection(
      collectionName,
      this.#config().activateName,
    );
  }
  export() {
    return this.#util.export(
      this.#config().collectionList.map(({ collectionName }) => collectionName),
    );
  }

  async destroy() {
    return this.#util.destroyKnowledge(
      this.#config().collectionList.map(({ collectionName }) => collectionName),
      this.#vfs(),
    );
  }
}
