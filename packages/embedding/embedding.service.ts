import { inject } from 'static-injector';
import { EmbeddingConfigToken } from './type';
import { LRUCache } from 'lru-cache';
import { chunk, uniq } from 'es-toolkit';
import { promise as fastq } from 'fastq';
export class EmbeddingService {
  #config = inject(EmbeddingConfigToken);
  #cache = new LRUCache<string, Promise<number[]>>({
    max: this.#config.maxCache,
    ttl: this.#config.ttl,
  });

  #queue = fastq(
    async (value: string[]): Promise<number[][]> =>
      this.#config.text2Vec(value),
    this.#config.maxAsyncCount,
  );
  async text2Vec<T extends string | string[]>(
    value: T,
  ): Promise<T extends string ? number[] : number[][]> {
    if (typeof value === 'string') {
      if (!this.#cache.has(value)) {
        const data = this.#queue.push([value]).then(([item]) => item);
        this.#cache.set(value, data);
      }
      return (await this.#cache.get(value))! as any;
    }
    const cachedObj = {} as Record<string, Promise<number[]>>;
    const pendingList = [] as string[];
    for (const item of uniq(value)) {
      if (this.#cache.has(item)) {
        cachedObj[item] = this.#cache.get(item)!;
      } else {
        pendingList.push(item);
      }
    }
    if (pendingList.length) {
      const chunPendingList = chunk(pendingList, this.#config.maxBatchSize);
      await Promise.all(
        chunPendingList.map((subList) =>
          this.#queue.push(subList).then((list) =>
            list.forEach((item, i) => {
              cachedObj[subList[i]] = Promise.resolve(item);
              this.#cache.set(subList[i], cachedObj[subList[i]]);
            }),
          ),
        ),
      );
    }
    return Promise.all(value.map((item) => cachedObj[item]!)) as any;
  }
}
