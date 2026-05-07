import { inject, Injector, Signal } from 'static-injector';
import { ConfigToken, getGraphCollectionName, Text2VecToken } from '../const';
import { KnowledgeUtilService } from '../knowledge.util.service';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { LogToken } from '@shenghuabi/knowledge/util';
import { promise as fastq } from 'fastq';

import { ContentParserToken } from './const';
import { entryFormat } from '../template.format';
import { edgeVectorString, nodeVectorString } from './vecotr-format';
import { v4 } from 'uuid';
import { NormalKnowledgeService } from '../normal/normal.knowledge.service';
import {
  GraphCollectionDefine,
  GraphCollectionInlineType,
  GraphKnowledgeConfigInline,
} from './define/config';
import * as v from 'valibot';
import { GraphKnowledgeUtilService } from './graph.util.service';
import { GraphLocalService } from './graph.local.service';
import { FileChunkPayload } from '../common/define/chunk';
import { BatchQueue } from '@shenghuabi/knowledge/util';

export class GraphKnolwdgeService extends NormalKnowledgeService {
  #text2vec = inject(Text2VecToken);
  #config = inject<Signal<GraphKnowledgeConfigInline>>(ConfigToken);
  #util = inject(KnowledgeUtilService);
  #graphUtil = inject(GraphKnowledgeUtilService);
  #qdClient = inject(QdrantClientService);
  #channel = inject(LogToken);
  #injector = inject(Injector);
  #contentParser = inject(ContentParserToken);
  #graphLocal = inject(GraphLocalService);

  override formatCollection(input: any) {
    return v.parse(GraphCollectionDefine, input);
  }
  async #createCollection(collection: GraphCollectionInlineType) {
    const collectionName = getGraphCollectionName(collection.collectionName);
    this.#channel.info(`创建图集合:${collectionName}`);
    const { exists } = await this.#qdClient.collectionExists(collectionName);
    if (exists) {
      throw new Error(`集合${collectionName}已存在`);
    }
    await this.#qdClient.createCollection(collectionName, {
      vectors: {
        chunk: {
          size: collection.size,
          distance: 'Cosine',
          on_disk: true,
        },
      },
    });
    this.#channel.info(`创建图索引`);

    await this.#qdClient.createPayloadKeywordIndex(collectionName, 'kind');
    await this.#qdClient.createPayloadKeywordIndex(collectionName, 'fileName');
    await this.#qdClient.createPayloadKeywordIndex(collectionName, 'name');
    await this.#qdClient.createPayloadKeywordIndex(collectionName, 'source');
    await this.#qdClient.createPayloadKeywordIndex(collectionName, 'target');
  }
  override async create(collection: GraphCollectionInlineType) {
    await super.create(collection);
    await this.#createCollection(collection);
    await this.#qdClient.setActivateCollection(
      collection.graphCollectionName,
      this.#config().activateGraphName,
    );
  }

  /** 图谱知识库不允许改chunksize,因为改了后切片就不一样了,那么生成的关系一定也不一样了 */
  override async insertItem(
    fileName: string,
    content: string,
    signal?: AbortSignal,
  ) {
    const list = await this._insertItem(fileName, content);
    if (!list || !list.length) {
      return;
    }
    const result = list[0].map(({ payload }) => payload);

    await this.#insert(result as any, fileName, signal);
  }
  async #insert(
    chunkList: FileChunkPayload[],
    fileName: string,
    signal?: AbortSignal,
  ) {
    const countObj = {
      success: 0,
      error: 0,
    };
    const hasGraph = !!this.#graphLocal.getGraph();
    // 工作流如果执行失败应该全退出,防止不断执行
    const llmAsyncQueue = fastq(async (document: FileChunkPayload) => {
      if (signal?.aborted) {
        return;
      }
      /** 输入解析 */
      const extractData = await this.#contentParser.parse(document, signal);
      countObj.success++;

      const nodes = extractData.entity.map((item) => ({
        id: v4(),
        payload: {
          ...item,
          fileName,
          chunkId: document.hash,
        },
      }));
      const edges = extractData.entity_relation.map((item) => ({
        id: v4(),
        payload: {
          ...item,
          fileName,
          chunkId: document.hash,
        },
      }));
      const keywords = extractData.keyword.map((item) => ({
        id: v4(),
        payload: {
          keyword: item,
          chunkId: document.hash,
          fileName,
        },
      }));
      await this.#graphUtil.updateContext(async () => ({
        upsert: {
          nodes,
          edges,
          keywords,
        },
      }));
      // 更新图谱
      if (hasGraph) {
        this.#graphLocal.add({
          nodes: nodes.map((item) => ({ ...item.payload, id: item.id })),
          edges: edges.map((item) => ({ ...item.payload, id: item.id })),
        });
      }
    }, this.#config().maxChunkAsync);
    llmAsyncQueue.error((error, task) => {
      if (error) {
        countObj.error++;
        this.#channel.warn(`[${fileName}]解析失败:\n${task.chunk}\n`, error);
      }
    });
    for (const item of chunkList) {
      llmAsyncQueue.push(item);
    }
    await llmAsyncQueue.drained();
    if (signal?.aborted) {
      return this.deleteItem(fileName);
    }
    // 如果失败过多就删除
    if (chunkList.length === countObj.error) {
      await super.deleteItem(fileName);
    }
  }

  override async deleteItem(fileName: string) {
    await super.deleteItem(fileName);
    await this.#util.multiDelete(
      this.#config().collectionList.map((item) => item.graphCollectionName),
      {
        filter: {
          must: [{ key: 'fileName', match: { value: fileName } }],
          should: null,
        },
      },
    );
  }
  override async updateItem(fileName: string, content: string) {
    await this.deleteItem(fileName);
    await this.insertItem(fileName, content);
  }

  override async addCollection(collection: GraphCollectionInlineType) {
    const activateCollectionName = this.#config().activateGraphName;

    await super.addCollection(collection);
    await this.#createCollection(collection);

    /** 从激活的集合中获取数据(理论上数据都是同步的) */
    const newCollectionName = collection.graphCollectionName;
    const batchQueue = new BatchQueue((item: string[]) =>
      this.#text2vec(item, collection.collectionName),
    );
    const queue = this.#util.updatePointsQueue(newCollectionName);

    let queueError = undefined;
    queue.queue.error((err) => {
      if (err) {
        queueError = err;
        queue.queue.killAndDrain();
      }
    });
    let offset: any;
    do {
      const { points, next_page_offset } = await this.#qdClient.scroll(
        activateCollectionName,
        {
          limit: 5000,
          with_payload: true,
          with_vector: false,
          offset: offset,
        },
      );
      //   const instance = await this.#batchExtract$.get(config.embedding);
      await batchQueue.then(
        Promise.all([
          Promise.all(
            points.map(async (point) => {
              let embeddingChunk: string;
              if (point.payload!['kind'] === 'node') {
                embeddingChunk = entryFormat(
                  point.payload!,
                  this.#config().name,
                  nodeVectorString(point.payload as any),
                  collection.embeddingTemplate?.node,
                );
              } else if (point.payload!['kind'] === 'edge') {
                embeddingChunk = entryFormat(
                  point.payload!,
                  this.#config().name,
                  edgeVectorString(point.payload as any),
                  collection.embeddingTemplate?.edge,
                );
              } else {
                embeddingChunk = point.payload!['keyword'] as any;
              }
              const vector = await batchQueue.push(embeddingChunk);
              queue.push({
                id: point.id,
                payload: {
                  ...point.payload!,
                  embeddingChunk: embeddingChunk,
                },
                vector: {
                  chunk: vector,
                },
              });
            }),
          ),
        ]),
      );

      offset = next_page_offset;
    } while (offset);

    queue.complete();
    await queue.queue.drained();
    if (queueError) {
      await this.#qdClient.deleteCollection(collection.collectionName);
      await this.#qdClient.deleteCollection(collection.graphCollectionName);
      throw queueError;
    }
    await this.#qdClient.setActivateCollection(
      newCollectionName,
      this.#config().activateGraphName,
    );
  }
  override async deleteCollection(collectionName: string) {
    const result = await super.deleteCollection(collectionName);
    if (!result) {
      return result;
    }

    const collection = this.#config().collectionList.find(
      (item) => item.collectionName === collectionName,
    )!;
    await this.#qdClient.deleteCollection(collection.graphCollectionName);
    return true;
  }
  override async changeActivateCollection(collectionName: string) {
    await super.changeActivateCollection(collectionName);
    await this.#qdClient.setActivateCollection(
      getGraphCollectionName(collectionName),
      this.#config().activateGraphName,
    );
  }
  override export() {
    return this.#util.export(
      this.#config().collectionList.flatMap(
        ({ collectionName, graphCollectionName }) => [
          collectionName,
          graphCollectionName,
        ],
      ),
    );
  }

  override async destroy() {
    await super.destroy();
    return this.#util.destroyKnowledge(
      this.#config().collectionList.map(
        ({ graphCollectionName }) => graphCollectionName,
      ),
    );
  }
}
