import { computed, inject, Signal } from 'static-injector';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import {
  ConfigToken,
  DirToken,
  OCRToken,
  ReRankerToken,
  Text2VecToken,
  TextSplitterToken,
} from '../const';
import { DictInput, DictService, WordItem } from '@shenghuabi/knowledge/file-parser';
import { v4 } from 'uuid';
import { promise as fastq } from 'fastq';
import {
  BatchQueue,
  CacheQueue,
  html2Text,
  isTruthy,
  LogToken,
} from '@shenghuabi/knowledge/util';
import { entryFormat } from '../template.format';
import { createNormalizeVfs, path } from '@cyia/vfs2';
import { KnowledgeUtilService } from '../knowledge.util.service';
import {
  DictCollectionDefine,
  DictCollectionInlineType,
  DictKnowledgeConfigInline,
} from './define/config';
import * as v from 'valibot';
import { CommonKnowledgeService } from '../common/common.knowledge.service';
import { QueryOptions } from '../common/query';

export class DictKnowledgeService extends CommonKnowledgeService {
  #text2vec = inject(Text2VecToken);
  #reranker = inject(ReRankerToken);

  #textSplitter = inject(TextSplitterToken);
  #ocr = inject(OCRToken, { optional: true }) || undefined;
  #config = inject<Signal<DictKnowledgeConfigInline>>(ConfigToken);
  #vfs = computed(() => createNormalizeVfs({ dir: this.#dir() }));
  #qdClient = inject(QdrantClientService);
  #dict = inject(DictService);
  #util = inject(KnowledgeUtilService);
  #dir = inject(DirToken);
  #log = inject(LogToken);
  formatCollection(input: any) {
    return v.parse(DictCollectionDefine, input);
  }
  async #createCollection(collection: DictCollectionInlineType) {
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
        word: {
          size: collection.size,
          distance: 'Cosine',
          on_disk: true,
        },
      },
    });
    await this.#qdClient.createPayloadKeywordIndex(
      collection.collectionName,
      'word',
    );
    await this.#qdClient.createPayloadKeywordIndex(
      collection.collectionName,
      'chunk',
    );
    await this.#qdClient.createPayloadKeywordIndex(
      collection.collectionName,
      'content',
    );
  }
  /** 只创建这一次,剩下的都是插入或更新 */
  async create(collection: DictCollectionInlineType) {
    await this.#createCollection(collection);
    await this.#qdClient.setActivateCollection(
      this.#config().name,
      this.#config().activateName,
    );
  }
  async #getImportQueue(
    collection: DictCollectionInlineType,
    /** 是否要处理资源,主要是克隆用 */ assetHandle: boolean,
  ) {
    /** 资源文件夹 */
    const assetFolder = path.join(this.#dir(), 'assets');
    const contentBatchQueue = new BatchQueue((str: string[]) =>
      this.#text2vec(str, collection.collectionName),
    );
    let sum = 0;
    const updateCacheQueue = this.#util.updatePointsQueue<
      { word: number[]; chunk: number[] },
      Record<string, any>
    >(collection.collectionName);
    let updateError: Error | undefined;
    updateCacheQueue.queue.error((error) => {
      if (error) {
        updateError = error;
        updateCacheQueue.queue.killAndDrain();
      }
    });

    const importCacheQueue = new CacheQueue(
      fastq(async (wordList: WordItem[]) => {
        /** 数据预处理 */
        const preMergeList = (
          await Promise.all(
            wordList.map(async (entryItem) => {
              // 词条提取
              if (assetHandle) {
                if (this.#config().extractorWord) {
                  this.#vfs().write(entryItem.word, entryItem.content);
                }
              }
              const formatedContent = assetHandle
                ? await this.#formatContent(entryItem, assetFolder, {
                    useOcr: this.#config().useOcr,
                    refReplace: true,
                  })
                : (entryItem as any).formatedContent || entryItem.content;
              const splitContentList = (
                await this.#textSplitter(
                  formatedContent,
                  {
                    ...entryItem,
                    formatedContent,
                  },
                  collection.collectionName,
                )
              ).filter((item) => !!item.pageContent.trim());
              if (!splitContentList.length) {
                return undefined;
              }
              return {
                word: entryItem.word,
                contentList: splitContentList
                  .map((item) => {
                    const pageContent = item.pageContent.trim();
                    const metadata = {
                      ...item.metadata,
                      chunk: pageContent,
                    } as Record<string, any>;
                    const embeddingChunk = entryFormat(
                      metadata,
                      this.#config().name,
                      `${metadata['word']}\n${pageContent}`,
                      collection.embeddingTemplate?.entry,
                    );
                    if (!embeddingChunk) {
                      this.#log.warn(
                        `内容格式化后内容为空,跳过\n${JSON.stringify({ payload: metadata, knowledge: this.#config().name, pageContent })}`,
                      );
                      return;
                    }
                    metadata['embeddingChunk'] = embeddingChunk;
                    return {
                      chunk: embeddingChunk,
                      metadata: metadata,
                    };
                  })
                  .filter(isTruthy),
              };
            }),
          )
        )
          .filter(isTruthy)
          .filter((item) => !!item.contentList.length);
        if (!preMergeList.length) {
          return;
        }
        const [wordVecResult, contentVecResult] = await Promise.all([
          this.#text2vec(
            preMergeList.map((item) => item.word),
            collection.collectionName,
          ),
          contentBatchQueue.then(
            Promise.all(
              preMergeList.flatMap((item) =>
                item.contentList.map((item) =>
                  contentBatchQueue.push(item.chunk),
                ),
              ),
            ),
          ),
        ]);

        let startIndex = 0;

        for (let i = 0; i < preMergeList.length; i++) {
          const preData = preMergeList[i];
          const wordVector = wordVecResult[i];
          const endIndex = startIndex + preData.contentList.length;
          const extResult = contentVecResult.slice(startIndex, endIndex);
          startIndex = endIndex;
          extResult.forEach((item, j) => {
            updateCacheQueue.push({
              id: v4(),
              vector: {
                word: wordVector,
                chunk: extResult[j],
              },
              payload: preData.contentList[j].metadata,
            });
          });
        }

        sum += wordList.length;
        this.#log.info(`已导入 ${sum} 条`);
      }, 2),
      256,
    );
    importCacheQueue.queue.error((error) => {
      if (error) {
        updateError = error;
        importCacheQueue.queue.killAndDrain();
      }
    });
    return {
      importQueue: importCacheQueue,
      getSum: () => sum,
      updateQueue: updateCacheQueue,
      getError() {
        return updateError;
      },
    };
  }
  async importDict(input: DictInput) {
    const collection = this.#config().collectionList[0];
    /** 知识库保存的名字 */
    return this.#dict
      .importDict(this.#config().name, this.#dir(), input)
      .then(async (generator) => {
        const { importQueue, getSum, updateQueue, getError } =
          await this.#getImportQueue(collection, true);

        for await (const item of generator) {
          importQueue.push(item);
        }
        importQueue.complete();
        await importQueue.queue.drained();
        updateQueue.complete();
        await updateQueue.queue.drained();
        const error = getError();
        if (error) {
          throw error;
        }
        return getSum();
      })
      .catch(async (rej) => {
        this.#log.error(`导入失败`, rej);
        // 导入失败自动销毁
        await this.destroy();
        throw rej;
      });
  }

  async #formatContent(
    wordItem: WordItem,
    assetFolder: string,
    options: {
      useOcr?: boolean;
      refReplace: boolean;
    },
  ) {
    const result = await html2Text(wordItem.htmlContent ?? wordItem.content, {
      useOcr: options.useOcr,
      ocrFn: this.#ocr,
      assetFolder: assetFolder,
    });
    return options.refReplace ? result.replaceAll(`～`, wordItem.word) : result;
  }

  async addCollection(collection: DictCollectionInlineType) {
    await this.#createCollection(collection);

    const { importQueue, updateQueue, getError } = await this.#getImportQueue(
      collection,
      false,
    );

    try {
      let offset: any;
      const activateCollectionName = this.#config().activateName;
      const wordSet = new Set<string>();
      do {
        const { points, next_page_offset } = await this.#qdClient.scroll(
          activateCollectionName,
          {
            limit: 5000,
            with_payload: true,
            offset: offset,
          },
        );
        for (const point of points) {
          // 跳过已存在的词条(因为没用实体文件,所以是需要id标记)
          const id = `${point.payload!['word']}|${point.payload!['formatedContent'] || point.payload!['content']}`;
          if (wordSet.has(id)) {
            continue;
          }
          wordSet.add(id);
          importQueue.push(point.payload as any);
        }
        offset = next_page_offset;
      } while (offset);
      importQueue.complete();
      await importQueue.queue.drained();
      updateQueue.complete();
      await updateQueue.queue.drained();
      const error = getError();
      if (error) {
        throw error;
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

  async searchWord(text: string, options: QueryOptions) {
    const queryResult = await this.#qdClient.search(
      this.#config().activateName,
      {
        limit: options.limit
          ? options.limit * this.#reranker.getQueryRatio()
          : undefined,
        with_payload: true,
        with_vector: false,
        score_threshold: options.score,
        offset: options.offset,
        vector: {
          name: 'word',
          vector: await this.#text2vec(text, this.#config().activateCollection),
        },
      },
    );
    const resultList = await this.#reranker.run({
      value: text,
      docs: queryResult.map((item) => item.payload?.['word']! as string),
    });
    return resultList
      .slice(0, options?.limit)
      .map(({ index }) => queryResult[index]);
  }
  /** 当普通数据库用 */
  matchWord(text: string, options: { limit: number }) {
    return this.#qdClient.scroll(this.#config().activateName, {
      limit: options.limit,
      filter: {
        must: {
          key: 'word',
          match: {
            value: text,
          },
        },
      },
      with_payload: true,
      with_vector: false,
    });
  }
}
