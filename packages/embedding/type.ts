import { InjectionToken } from 'static-injector';

export type EmbeddingConfig = {
  /** 缓存嵌入数量 */
  maxCache: number;
  /** 超时清除 */
  ttl: number;
  /** 每批最大数量 */
  maxBatchSize: number;
  maxAsyncCount: number;
  text2Vec: (list: string[]) => Promise<number[][]>;
};
export const EmbeddingConfigToken = new InjectionToken<EmbeddingConfig>(
  'EmbeddingConfig',
);
