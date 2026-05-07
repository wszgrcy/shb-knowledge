import { runInEmbeddingContext } from '@shenghuabi/knowledge/util';
import { inject, Signal } from 'static-injector';
import { ConfigToken, Text2VecToken } from '../const';
import { entryFormat } from '../template.format';
import { GraphKnowledgeConfigInline } from './define/config';
import { nodeVectorString, edgeVectorString } from './vecotr-format';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import {
  EdgePayloadNewDefine,
  KeywordPayloadNewDefine,
  NodePayloadNewDefine,
} from './define/define';
import * as v from 'valibot';
export class GraphKnowledgeUtilService {
  #qdClient = inject(QdrantClientService);

  #config = inject<Signal<GraphKnowledgeConfigInline>>(ConfigToken);
  #text2vec = inject(Text2VecToken);
  updateContext(
    fn: () => Promise<{
      upsert?: {
        nodes?: { id: any; payload: any }[];
        edges?: { id: any; payload: any }[];
        keywords?: { id: any; payload: any }[];
      };
      delete?: {
        nodes?: { id: any }[] | { filter?: any };
        edges?:
          | {
              id: any;
            }[]
          | { filter?: any };
      };
    }>,
  ) {
    return runInEmbeddingContext(async (t2v) => {
      const result = await fn();
      const requstList = [];
      if (result.upsert) {
        requstList.push(
          this.#config().collectionList.map(
            async ({
              graphCollectionName,
              collectionName,
              embeddingTemplate,
            }) => {
              const list = [];
              if (result.upsert?.nodes?.length) {
                list.push(
                  Promise.all(
                    result.upsert?.nodes.map(async (item) => {
                      const embeddingChunk = entryFormat(
                        item.payload,
                        this.#config().name,
                        nodeVectorString(item.payload),
                        embeddingTemplate?.node,
                      );
                      return {
                        id: item.id,
                        payload: v.parse(NodePayloadNewDefine, {
                          ...item.payload,
                          embeddingChunk,
                        }),
                        vector: {
                          chunk: await t2v(embeddingChunk, collectionName),
                        },
                      };
                    }),
                  ).then((points) =>
                    this.#qdClient.upsert(graphCollectionName, { points }),
                  ),
                );
              }
              if (result.upsert?.edges?.length) {
                list.push(
                  Promise.all(
                    result.upsert?.edges.map(async (item) => {
                      const embeddingChunk = entryFormat(
                        item.payload,
                        this.#config().name,
                        edgeVectorString(item.payload),
                        embeddingTemplate?.edge,
                      );

                      return {
                        id: item.id,
                        payload: v.parse(EdgePayloadNewDefine, {
                          ...item.payload,
                          embeddingChunk,
                        }),
                        vector: {
                          chunk: await t2v(embeddingChunk, collectionName),
                        },
                      };
                    }),
                  ).then((points) =>
                    this.#qdClient.upsert(graphCollectionName, { points }),
                  ),
                );
              }
              if (result.upsert?.keywords?.length) {
                list.push(
                  Promise.all(
                    result.upsert?.keywords.map(async (item) => ({
                      id: item.id,
                      payload: v.parse(KeywordPayloadNewDefine, item.payload),
                      vector: {
                        chunk: await t2v(item.payload.keyword, collectionName),
                      },
                    })),
                  ).then((points) =>
                    this.#qdClient.upsert(graphCollectionName, { points }),
                  ),
                );
              }
              return Promise.all(list);
            },
          ),
        );
      }
      if (result.delete) {
        requstList.push(
          this.#config().collectionList.map(
            async ({ graphCollectionName, collectionName }) => {
              await Promise.all(
                [result.delete?.nodes, result.delete?.edges].map(
                  (deleteData) => {
                    if (Array.isArray(deleteData)) {
                      if (deleteData.length) {
                        return this.#qdClient.delete(graphCollectionName, {
                          points: deleteData.map((item) => item.id),
                        });
                      }
                    } else if (deleteData) {
                      return this.#qdClient.delete(graphCollectionName, {
                        filter: deleteData.filter,
                      });
                    }
                  },
                ),
              );
            },
          ),
        );
      }
      return Promise.all(requstList.flat());
    }, this.#text2vec);
  }
}
