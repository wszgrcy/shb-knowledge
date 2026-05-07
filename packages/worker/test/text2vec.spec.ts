import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createRootInjector } from 'static-injector';
import { StardictParseService } from '../../file-parser/dict/dict-format/stardict-parse.service';
import { createNormalizeVfs, path } from '@cyia/vfs2';
import Tinypool from 'tinypool';
import { WordItem } from '@shenghuabi/knowledge/file-parser';
import { BatchQueue, isTruthy, CacheQueue } from '@shenghuabi/knowledge/util';
import { promise as fastq } from 'fastq';
import { expect } from 'chai';
import { DslParseService } from '../../file-parser/dict/dict-format/dsl/dsl-parse.service';
import { pathToFileURL } from 'node:url';
function createWorker(count: number) {
  const instance = new Tinypool({
    filename: pathToFileURL(
      path.join(process.cwd(), 'test-dist/worker/text2vec.mjs'),
    ).href,
    maxThreads: count,
    maxQueue: 9999,
    concurrentTasksPerWorker: 4,
    runtime: 'worker_threads',
  });
  return instance;
}
describe('text2vec', () => {
  // 单独测试
  it.skip('init', async () => {
    const worker = createWorker(1);
    const dir = path.join(process.cwd(), 'bin', 'text2vec');
    const { port1, port2 } = new MessageChannel();
    port2.on('message', (value) => {
      console.log('信息', value);
    });
    const result = await worker.run(
      {
        dir: dir,
        modelName: 'Xenova/bge-base-zh-v1.5',
        options: {
          device: process.env.CI ? 'cpu' : 'dml',
          dtype: 'fp16',
        },
        port: port1,
      },
      { name: 'init', transferList: [port1] },
    );
    port2.close();

    expect(result).eq(true);
    const fs = createNormalizeVfs({ dir: dir });
    const exists = await fs.exists('Xenova/bge-base-zh-v1.5');
    expect(exists).eq(true);
    worker.destroy();
  });

  it.skip('测试最佳嵌入速度', async () => {
    const dir = path.join(process.cwd(), 'bin', 'text2vec');

    // 200 以后基本上不影响速度
    // 开4个线程就可以了,
    //batchSize 不变 asyncCount越大,速度越快
    //asyncCount 基本不影响速度
    // 目前的问题在于worker设计
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 20,
    });
    const injector = createRootInjector({ providers: [] });
    const instance = injector.get(StardictParseService);

    const testList = [
      { batchSize: 8, asyncCount: 256, workerCount: 1 },
      { batchSize: 8, asyncCount: 256, workerCount: 2 },
      { batchSize: 8, asyncCount: 256, workerCount: 4 },
    ];

    // stardict-kdic-computer-gb-2.4.2.tar.bz2
    //'stardict-anatilim-chinese-uyghur_cn-uy-2.4.2.tar.bz2';
    const name = 'stardict-kdic-computer-gb-2.4.2.tar.bz2';
    for (const testItem of testList) {
      const { port1, port2 } = new MessageChannel();
      const p1 = new Tinypool({
        filename: new URL(
          'file:/' + path.join(process.cwd(), 'test-dist/worker/text2vec.mjs'),
          import.meta.url,
        ).href,
        maxThreads: testItem.workerCount,
        concurrentTasksPerWorker: 2,
      });
      await p1.run(
        {
          dir: dir,
          modelName: 'Xenova/bge-base-zh-v1.5',
          options: {
            device: process.env.CI ? 'cpu' : 'dml',
            dtype: 'fp16',
          },
          port: port1,
          remoteHost: 'hg-model.tbontop.top',
        },
        { name: 'init', transferList: [port1] },
      );
      const text2vecFn = async (input: string[]) => {
        const result = await p1.run(
          {
            value: input,
            dir: dir,
            modelName: 'Xenova/bge-base-zh-v1.5',
            options: {
              device: process.env.CI ? 'cpu' : 'dml',
              dtype: 'fp16',
            },
          },
          { name: 'convert' },
        );
        expect(result.length).eq(input.length);
        for (const item of result) {
          expect(item.length).eq(768);
        }
        return result;
      };
      port1.close();
      const start = Date.now();
      const { dataListGenerator, info } = await instance.parse(
        path.join(process.cwd(), './packages/file-parser/test/fixture', name),
      );
      const contentBatchQueue = new BatchQueue(text2vecFn);
      const fn = async (wordList: WordItem[]) => {
        /** 数据预处理 */
        const preMergeList = (
          await Promise.all(
            wordList.map(async (entryItem) => {
              // 词条提取

              const formatedContent = entryItem.content;
              const splitContentList = await textSplitter.createDocuments(
                [formatedContent],
                [
                  {
                    ...entryItem,
                    formatedContent,
                  },
                ],
              );
              if (!splitContentList.length) {
                return undefined;
              }
              return {
                word: entryItem.word,
                contentList: splitContentList.map((item) => {
                  const metadata = {
                    ...item.metadata,
                    chunk: item.pageContent,
                  } as Record<string, any>;

                  return {
                    content: item.pageContent,
                    metadata: metadata,
                  };
                }),
              };
            }),
          )
        ).filter(isTruthy);

        await Promise.all([
          text2vecFn(preMergeList.map((item) => item.word)),
          contentBatchQueue.then(
            Promise.all(
              preMergeList.flatMap((item) =>
                item.contentList.map((item) =>
                  contentBatchQueue.push(item.content),
                ),
              ),
            ),
          ),
        ]);
      };

      const cacheQueue = new CacheQueue(
        fastq(fn, testItem.batchSize),
        testItem.asyncCount,
      );
      cacheQueue.queue.error((error) => {
        if (error) {
          console.log('异常', error);
        }
      });
      for await (const item of dataListGenerator()) {
        cacheQueue.push(item);
      }
      cacheQueue.complete();
      await cacheQueue.queue.drained();
      console.log(
        `用时 ${(Date.now() - start) / 1000} 参数 ${JSON.stringify(testItem)}`,
      );
      // await p1.terminate();
    }
  });
  // 测试完成后保存
  it.skip('dsl测试', async () => {
    const dir = path.join(process.cwd(), 'bin', 'text2vec');

    // 200 以后基本上不影响速度
    // 开4个线程就可以了,
    //batchSize 不变 asyncCount越大,速度越快
    //asyncCount 基本不影响速度
    // 目前的问题在于worker设计
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 100,
      chunkOverlap: 20,
    });
    const injector = createRootInjector({ providers: [] });
    const instance = injector.get(DslParseService);

    const testList = [
      { batchSize: 8, asyncCount: 256, workerCount: 1 },
      { batchSize: 8, asyncCount: 256, workerCount: 2 },
      { batchSize: 8, asyncCount: 256, workerCount: 4 },
    ];

    // stardict-kdic-computer-gb-2.4.2.tar.bz2
    //'stardict-anatilim-chinese-uyghur_cn-uy-2.4.2.tar.bz2';
    const name = 'dsl-demo/UniversalEnDe.dsl';
    for (const testItem of testList) {
      const start = Date.now();
      const { dataListGenerator, info } = await instance.parse(
        path.join(process.cwd(), './packages/file-parser/test/fixture', name),
      );

      for await (const item of dataListGenerator()) {
        console.log(item);
      }

      console.log(
        `用时 ${(Date.now() - start) / 1000} 参数 ${JSON.stringify(testItem)}`,
      );
      // await p1.terminate();
    }
  });
  const list = new Array(2)
    .fill(undefined)
    .map((item) => Math.random().toString(16));
  it('convert', async () => {
    const worker = createWorker(1);
    const dir = path.join(process.cwd(), 'bin', 'text2vec');
    const initOptions = {
      dir: dir,
      modelName: 'Xenova/bge-base-zh-v1.5',
      options: {
        device: process.env.CI ? 'cpu' : 'dml',
        dtype: 'fp16',
      },
      remoteHost: 'hg-model.tbontop.top',
    };
    await worker.run(initOptions, { name: 'init', transferList: [] });
    const start = Date.now();
    const result = await worker.run(
      { ...initOptions, value: list },
      { name: 'convert' },
    );
    console.log(Date.now() - start);

    expect(result.length).eq(2);
    expect(result[0].length).eq(768);
    const size = await worker.run(undefined, { name: 'getSize' });
    expect(size).eq(768);
    worker.destroy();
  });
  it.skip('qwen3-convert', async () => {
    const worker = createWorker(1);
    const dir = path.join(process.cwd(), 'bin', 'text2vec');
    const initOptions = {
      dir: dir,
      modelName: `onnx-community/Qwen3-Embedding-0.6B-ONNX`,
      options: {
        device: process.env.CI ? 'cpu' : 'dml',
        dtype: 'fp16',
      },
      mode: 'qwen3',
      remoteHost: 'hg-model.tbontop.top',
    };
    await worker.run(initOptions, { name: 'init', transferList: [] });

    const start = Date.now();
    const result = await worker.run(
      {
        ...initOptions,
        value: list,
      },
      { name: 'convert' },
    );
    console.log(Date.now() - start);
    expect(result.length).eq(2);
    expect(result[0].length).eq(1024);
    const size = await worker.run(undefined, { name: 'getSize' });
    expect(size).eq(1024);
    worker.destroy();
  });
});
