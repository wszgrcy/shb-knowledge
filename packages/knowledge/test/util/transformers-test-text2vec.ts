import { env, pipeline } from '@huggingface/transformers';
import path from 'path';

export async function transformersText2Vec<T extends string | string[]>(
  str: T,
  collectionName: string,
): Promise<T extends string ? number[] : number[][]> {
  const dir = path.join(process.cwd(), 'bin/text2vec');
  env.localModelPath = dir;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  env.cacheDir = dir;
  let instance;
  // 附加collection
  if (collectionName.includes('384')) {
    instance = await pipeline(
      'feature-extraction',
      'Xenova/jina-embeddings-v2-small-en',
      { device: process.env.CI ? 'cpu' : 'dml', dtype: 'fp16' },
    );
  } else if (collectionName.includes('312')) {
    // 默认name
    instance = await pipeline(
      'feature-extraction',
      'Xenova/jina-embeddings-v2-small-en',
      { device: process.env.CI ? 'cpu' : 'dml', dtype: 'fp16' },
    );
  } else {
    throw '无效名字';
  }
  const result = (
    await instance(str, { pooling: 'mean', normalize: true })
  ).tolist();
  if (typeof str === 'string') {
    return result[0];
  }
  return result;
}
