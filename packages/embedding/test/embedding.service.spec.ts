import { createRootInjector } from 'static-injector';
import { EmbeddingService } from '../embedding.service';
import { EmbeddingConfig, EmbeddingConfigToken } from '../type';
import { expect } from 'chai';

describe('embedding', () => {
  it('hello', async () => {
    const injector = createRootInjector({
      providers: [
        EmbeddingService,
        {
          provide: EmbeddingConfigToken,
          useValue: {
            maxCache: 100,
            ttl: 1000,
            maxBatchSize: 99,
            maxAsyncCount: 999,
            text2Vec: async (list: string[]) =>
              list.map((item) => new Array(item.length).fill(0)),
          } as EmbeddingConfig,
        },
      ],
    });
    const embedding = await injector.get(EmbeddingService);
    const result = await embedding.text2Vec('hello');
    expect(result.length).eq('hello'.length);
    const result2 = await embedding.text2Vec(['t1', 't22']);
    expect(result2.length).eq(2);
    expect(result2[0].length).eq(2);
    expect(result2[1].length).eq(3);
  });
  it('缓存', async () => {
    const dataList = [
      { list: ['v1'], length: 1 },
      { list: ['v1', 'v2'], length: 1 },
      { list: ['v3', 'v3'], length: 1 },
      { list: ['v4', 'v5'], length: 2 },
      { list: ['v1', 'v3', 'v3'], length: 9999 },
    ];
    let index = 0;
    const injector = createRootInjector({
      providers: [
        EmbeddingService,
        {
          provide: EmbeddingConfigToken,
          useValue: {
            maxCache: 100,
            ttl: 1000,
            maxBatchSize: 99,
            maxAsyncCount: 999,

            text2Vec: async (list: string[]) => {
              const item = dataList[index++];
              expect(list.length).eq(item.length);
              return list.map((item) => new Array(item.length).fill(0));
            },
          } as EmbeddingConfig,
        },
      ],
    });
    const embedding = await injector.get(EmbeddingService);

    for (const item of dataList) {
      const result = await embedding.text2Vec(item.list);
      expect(result.length).eq(item.list.length);
      for (let index = 0; index < item.list.length; index++) {
        const element = item.list[index];
        expect(result[index].length).eq(element.length);
      }
    }
    expect(index).eq(4);
  });
  it('缓存数量', async () => {
    const dataList = [
      { list: ['v1'], length: 1 },
      { list: ['v1', 'v2'], length: 1 },
      { list: ['v1', 'v2'], length: 1 },
    ];
    let index = 0;
    const injector = createRootInjector({
      providers: [
        EmbeddingService,
        {
          provide: EmbeddingConfigToken,
          useValue: {
            maxCache: 1,
            ttl: 1000,
            maxBatchSize: 99,
            maxAsyncCount: 999,

            text2Vec: async (list: string[]) => {
              const item = dataList[index++];
              expect(list.length).eq(item.length);
              return list.map((item) => new Array(item.length).fill(0));
            },
          } as EmbeddingConfig,
        },
      ],
    });
    const embedding = await injector.get(EmbeddingService);

    for (const item of dataList) {
      const result = await embedding.text2Vec(item.list);
      expect(result.length).eq(item.list.length);
      for (let index = 0; index < item.list.length; index++) {
        const element = item.list[index];
        expect(result[index].length).eq(element.length);
      }
    }
    expect(index).eq(3);
  });
  it('批量切片', async () => {
    const dataList = [{ list: ['v1', 'v2'], length: 1 }];
    let index = 0;
    const injector = createRootInjector({
      providers: [
        EmbeddingService,
        {
          provide: EmbeddingConfigToken,
          useValue: {
            maxCache: 2,
            ttl: 1000,
            maxBatchSize: 1,
            maxAsyncCount: 999,

            text2Vec: async (list: string[]) => {
              index++;
              return list.map((item) => new Array(item.length).fill(0));
            },
          } as EmbeddingConfig,
        },
      ],
    });
    const embedding = await injector.get(EmbeddingService);

    for (const item of dataList) {
      const result = await embedding.text2Vec(item.list);
      expect(result.length).eq(item.list.length);
      for (let index = 0; index < item.list.length; index++) {
        const element = item.list[index];
        expect(result[index].length).eq(element.length);
      }
    }
    expect(index).eq(2);
  });
  it('同时请求限制(阻塞)', async () => {
    const dataList = [
      { list: ['v1'], length: 1 },
      { list: ['v2'], length: 1 },
    ];
    let index = 0;
    const injector = createRootInjector({
      providers: [
        EmbeddingService,
        {
          provide: EmbeddingConfigToken,
          useValue: {
            maxCache: 999,
            ttl: 1000,
            maxBatchSize: 999,
            maxAsyncCount: 1,
            text2Vec: async (list: string[]) => {
              index++;
              return new Promise((resolve) => {
                setTimeout(
                  () => {
                    resolve(list.map((item) => new Array(item.length).fill(0)));
                  },
                  10 - index * 5,
                );
              });
            },
          } as EmbeddingConfig,
        },
      ],
    });
    const embedding = await injector.get(EmbeddingService);
    let index2 = 0;
    await Promise.all([
      embedding.text2Vec(dataList[0].list).then((list) => {
        expect(index2).eq(0);
        index2 += 1;
      }),
      embedding.text2Vec(dataList[1].list).then((list) => {
        expect(index2).eq(1);
      }),
    ]);
  });
  it('同时请求限制(同时处理)', async () => {
    const dataList = [
      { list: ['v1'], length: 1 },
      { list: ['v2'], length: 1 },
    ];
    let index = 0;
    const injector = createRootInjector({
      providers: [
        EmbeddingService,
        {
          provide: EmbeddingConfigToken,
          useValue: {
            maxCache: 999,
            ttl: 1000,
            maxBatchSize: 999,
            maxAsyncCount: 2,
            text2Vec: async (list: string[]) => {
              index++;
              return new Promise((resolve) => {
                setTimeout(
                  () => {
                    resolve(list.map((item) => new Array(item.length).fill(0)));
                  },
                  10 - index * 5,
                );
              });
            },
          } as EmbeddingConfig,
        },
      ],
    });
    const embedding = await injector.get(EmbeddingService);
    let index2 = 0;
    await Promise.all([
      embedding.text2Vec(dataList[0].list).then((list) => {
        expect(index2).eq(2);
      }),
      embedding.text2Vec(dataList[1].list).then((list) => {
        expect(index2).eq(0);
        index2 += 2;
      }),
    ]);
  });
});
