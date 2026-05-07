import { inject, RootStaticInjectOptions } from 'static-injector';
import { QdrantClient } from '@qdrant/qdrant-js';
import { CacheQueue } from '@shenghuabi/knowledge/util';
import { promise as fastq } from 'fastq';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { NormalizeFs } from '@cyia/vfs2';

export class KnowledgeUtilService extends RootStaticInjectOptions {
  #qdClient = inject(QdrantClientService);

  multiDelete(list: string[], filter: Parameters<QdrantClient['delete']>[1]) {
    return Promise.all(list.map((item) => this.#qdClient.delete(item, filter)));
  }

  updatePointsQueue<
    Vector extends Record<string, number[]>,
    Payload extends Record<string, any>,
  >(collectionName: string) {
    return new CacheQueue(
      fastq(
        (
          list: {
            id: string | number;
            vector: Vector;
            payload: Payload;
          }[],
        ) =>
          this.#qdClient.upsert(collectionName, {
            wait: true,
            points: list,
          }),
        8,
      ),
      20,
    );
  }

  async destroyKnowledge(list: string[], vfs?: NormalizeFs) {
    await Promise.all(
      list.map((collectionName) =>
        this.#qdClient.deleteCollection(collectionName),
      ),
    );
    if (vfs && (await vfs.exists(''))) {
      await vfs.rm('', { recursive: true, force: true });
    }
  }
  export(list: string[]) {
    return Promise.all(
      list.map((collectionName) =>
        this.#qdClient.createSnapshot(collectionName).then((result) => ({
          ...result,
          collection: collectionName,
        })),
      ),
    );
  }
}
