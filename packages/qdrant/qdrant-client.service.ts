import {
  computed,
  inject,
  Injector,
  RootStaticInjectOptions,
} from 'static-injector';
import { QdrantClient } from '@qdrant/qdrant-js';

import { QdrantOptionsToken, QdrantStartToken } from './type';
export class QdrantClientService extends RootStaticInjectOptions {
  #injector = inject(Injector);
  #qdStart$$ = inject(QdrantStartToken);
  #client$$ = computed(() =>
    this.#qdStart$$.promise.then(() => {
      const options = this.#injector.get(QdrantOptionsToken);
      return new QdrantClient({
        ...options(),
        headers: { Connection: 'Close' },
      });
    }),
  );

  get originClient() {
    return this.#client$$();
  }

  async deleteCollection(name: string) {
    return (await this.#client$$()).deleteCollection(name);
  }
  async collectionExists(name: string) {
    return (await this.#client$$()).collectionExists(name);
  }
  async createCollection(
    ...args: Parameters<QdrantClient['createCollection']>
  ) {
    return (await this.#client$$()).createCollection(...args);
  }
  async getCollection(...args: Parameters<QdrantClient['getCollection']>) {
    return (await this.#client$$()).getCollection(...args);
  }

  async createPayloadKeywordIndex(collectionName: string, payloadName: string) {
    return (await this.#client$$()).createPayloadIndex(collectionName, {
      wait: true,
      field_name: payloadName,
      field_schema: 'keyword',
    });
  }
  async recoverSnapshot(...args: Parameters<QdrantClient['recoverSnapshot']>) {
    return (await this.#client$$()).recoverSnapshot(...args);
  }
  async createSnapshot(...args: Parameters<QdrantClient['createSnapshot']>) {
    return (await this.#client$$()).createSnapshot(...args);
  }
  async getAliases(...args: Parameters<QdrantClient['getAliases']>) {
    return (await this.#client$$()).getAliases(...args);
  }
  async getCollectionAliases(
    ...args: Parameters<QdrantClient['getCollectionAliases']>
  ) {
    return (await this.#client$$()).getCollectionAliases(...args);
  }
  async updateCollectionAliases(
    ...args: Parameters<QdrantClient['updateCollectionAliases']>
  ) {
    return (await this.#client$$()).updateCollectionAliases(...args);
  }
  async setActivateCollection(collection: string, activateCollection: string) {
    return (await this.#client$$()).updateCollectionAliases({
      actions: [
        {
          create_alias: {
            collection_name: collection,
            alias_name: activateCollection,
          },
        },
      ],
    });
  }
  async upsert(...args: Parameters<QdrantClient['upsert']>) {
    await (await this.#client$$()).upsert(...args);
  }
  async delete(...args: Parameters<QdrantClient['delete']>) {
    await (await this.#client$$()).delete(...args);
  }
  async retrieve(...args: Parameters<QdrantClient['retrieve']>) {
    return (await this.#client$$()).retrieve(...args);
  }
  async scroll(...args: Parameters<QdrantClient['scroll']>) {
    return (await this.#client$$()).scroll(...args);
  }
  async count(...args: Parameters<QdrantClient['count']>) {
    return (await this.#client$$()).count(...args);
  }
  async searchPointGroups(
    ...args: Parameters<QdrantClient['searchPointGroups']>
  ) {
    return (await this.#client$$()).searchPointGroups(...args);
  }
  async queryGroups(...args: Parameters<QdrantClient['queryGroups']>) {
    return (await this.#client$$()).queryGroups(...args);
  }
  async query(...args: Parameters<QdrantClient['query']>) {
    return (await this.#client$$()).query(...args);
  }
  async search(...args: Parameters<QdrantClient['search']>) {
    return (await this.#client$$()).search(...args);
  }
}
