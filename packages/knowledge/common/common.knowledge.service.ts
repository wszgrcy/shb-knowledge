import { inject, Signal } from 'static-injector';
import { ConfigToken, ReRankerToken, Text2VecToken } from '../const';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { BaseKnowledgeConfigType } from './define/base';
import { FilterOptions, QueryOptions } from './query';

export class CommonKnowledgeService {
  #qdClient = inject(QdrantClientService);
  #config =
    inject<Signal<BaseKnowledgeConfigType & { activateName: string }>>(
      ConfigToken,
    );
  #text2vec = inject(Text2VecToken);
  #reranker = inject(ReRankerToken);

  async searchChunk(
    text: string,
    filter?: FilterOptions,
    options?: QueryOptions,
  ) {
    const queryResult = await this.#qdClient.search(
      this.#config().activateName,
      {
        limit: options?.limit
          ? options.limit * this.#reranker.getQueryRatio()
          : undefined,
        filter,
        with_payload: true,
        with_vector: false,
        score_threshold: options?.score,
        offset: options?.offset,
        vector: {
          name: 'chunk',
          vector: await this.#text2vec(text, this.#config().activateCollection),
        },
      },
    );

    const resultList = await this.#reranker.run({
      value: text,
      docs: queryResult.map(
        (item) => item.payload?.['embeddingChunk']! as string,
      ),
    });
    return resultList
      .slice(0, options?.limit)
      .map(({ index }) => queryResult[index]);
  }
  getCollection() {
    return this.#qdClient.getCollection(this.#config().activateName);
  }
}
