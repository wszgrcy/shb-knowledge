import { deepStrictEqual } from 'assert';
import { runInEmbeddingContext } from '../embedding-queue';

describe('词嵌入队列', () => {
  it('基础', async () => {
    const result = await runInEmbeddingContext(
      (t2v) => Promise.all([t2v('1', '1'), t2v('11', '1'), t2v('22', '2')]),
      async (str, collectionName): Promise<any> => {
        if (typeof str === 'string') {
          throw new Error('');
        } else {
          switch (collectionName) {
            case '1':
              return str.map((item) => new Array(item.length).fill(1));
            case '2':
              return str.map((item) => new Array(item.length).fill(2));
            default:
              throw new Error('');
          }
        }
      },
    );
    deepStrictEqual(result, [[1], [1, 1], [2, 2]]);
  });
});
