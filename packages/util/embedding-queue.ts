import { BatchQueue } from './batch-queue';
import { Text2Vec } from './type';
export type Text2VecItem = (
  value: string,
  collectionName: string,
) => Promise<number[]>;
export async function runInEmbeddingContext<RETUREN>(
  fn: (t2v: Text2VecItem) => RETUREN,
  t2v: Text2Vec,
) {
  const map = new Map<string, BatchQueue<string, number[]>>();
  const result = fn((text: string, collectionName: string) => {
    let instance = map.get(collectionName);
    if (!instance) {
      instance = new BatchQueue((str) => t2v(str, collectionName));
      map.set(collectionName, instance);
    }
    return instance.push(text);
  });

  return result;
}
