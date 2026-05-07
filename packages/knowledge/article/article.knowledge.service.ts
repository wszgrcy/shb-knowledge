import { getHash } from '@shenghuabi/knowledge/util';
import {
  ConfigToken,
  DirToken,
  NormalKnowledgeConfigInline,
  NormalKnowledgeService,
  ReRankerToken,
  Text2VecToken,
} from '..';
import { createNormalizeVfs, path } from '@cyia/vfs2';
import { computed, inject, Signal } from 'static-injector';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { FilterOptions, QueryOptions } from '../common/query';
import { KnowledgeUtilService } from '../knowledge.util.service';
import { ArticleCollectionInlineType } from './define';
import { promise as fastq } from 'fastq';
import { ArticlePayload, ArticlePayloadType } from './define/payload';
import * as v from 'valibot';
export class ArticleKnowledgeService extends NormalKnowledgeService {
  #text2vec = inject(Text2VecToken);
  #reranker = inject(ReRankerToken);
  #config = inject<Signal<NormalKnowledgeConfigInline>>(ConfigToken);
  #dir = inject(DirToken);
  #qdClient = inject(QdrantClientService);
  #util = inject(KnowledgeUtilService);
  #vfs = computed(() => createNormalizeVfs({ dir: this.#dir() }));

  protected override KeyWordIndex = ['fullName', 'dir', 'fileHash'];
  protected override getPayload(fileName: string, content: string) {
    return {
      fileHash: getHash(content),
      fullName: fileName,
      name: path.basename(fileName),
      dir: path.dirname(fileName),
    };
  }
  override async insertItem(fileName: string, content: string): Promise<void> {
    const { points } = await this.#qdClient.scroll(
      this.#config().activateName,
      {
        limit: 1,
        filter: {
          should: [
            { key: 'fileHash', match: { value: getHash(content) } },
            { key: 'fullName', match: { value: fileName } },
          ],
        },
      },
    );
    if (points.length) {
      return;
    }
    // 不需要生成实体文件,
    await this.insertItemOnly(fileName, content, this.#config().collectionList);
  }
  override async deleteItem(fileName: string) {
    await this.#util.multiDelete(
      this.#config().collectionList.map((item) => item.collectionName),
      {
        filter: {
          must: [{ key: 'fullName', match: { value: fileName } }],
          should: null,
        },
      },
    );
  }
  override async addCollection(collection: ArticleCollectionInlineType) {
    /** 保存文件,新创建的没有 */

    await this.createCollection(collection);

    try {
      const queue = fastq(async (payload: ArticlePayloadType) => {
        payload = v.parse(ArticlePayload, payload);

        const content = await this.#vfs().readContent(payload.fullName);
        if (!content) {
          return;
        }
        await this.insertItemOnly(payload.fullName, content, [collection]);
      }, 10);

      let offset: any;
      const wordSet = new Set<string>();
      let queueError;
      queue.error((error) => {
        if (error) {
          queueError = error;
          queue.killAndDrain();
        }
      });
      do {
        const { points, next_page_offset } = await this.#qdClient.scroll(
          this.#config().activateName,
          {
            limit: 5000,
            with_payload: true,
            offset: offset,
          },
        );
        for (const point of points) {
          // 跳过已存在的词条(因为没用实体文件,所以是需要id标记)
          const id = `${point.payload!['fileHash']}`;
          if (wordSet.has(id)) {
            continue;
          }
          wordSet.add(id);
          queue.push(point.payload as any);
        }
        offset = next_page_offset;
      } while (offset);
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

  override destroy(): Promise<void> {
    return this.#util.destroyKnowledge(
      this.#config().collectionList.map(({ collectionName }) => collectionName),
    );
  }

  async searchGroupByChunk(
    text: string,
    options: QueryOptions & {
      group_size: number;
      limit: number;
    },
    filter?: FilterOptions,
  ) {
    const queryResult = await this.#qdClient.searchPointGroups(
      this.#config().activateName,
      {
        group_by: 'hash',
        filter,
        with_payload: true,
        with_vector: false,
        score_threshold: options?.score,
        vector: {
          name: 'chunk',
          vector: await this.#text2vec(text, this.#config().activateCollection),
        },
        group_size: options.group_size * this.#reranker.getQueryRatio(),
        limit: options.limit!,
      },
    );

    return Promise.all(
      queryResult.groups.map(async (item) => {
        const resultList = await this.#reranker.run({
          value: text,
          docs: item.hits.map(
            (item) => item.payload?.['embeddingChunk']! as string,
          ),
        });
        return {
          ...item,
          hits: resultList
            .slice(0, options.group_size)
            .map(({ index }) => item.hits[index]),
        };
      }),
    );
  }
}
