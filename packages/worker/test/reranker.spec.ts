import { path } from '@cyia/vfs2';
import Tinypool from 'tinypool';
import { expect } from 'chai';
import { MessageChannel } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
function createWorker(count: number) {
  const instance = new Tinypool({
    filename: pathToFileURL(
      path.join(process.cwd(), 'test-dist/worker/reranker.mjs'),
    ).href,
    // maxThreads: count,
    // maxQueue: 9999,
    concurrentTasksPerWorker: 2,
    runtime: 'worker_threads',
  });
  return instance;
}
describe('reranker', () => {
  it('convert', async () => {
    const worker = createWorker(1);
    const dir = path.join(process.cwd(), 'bin', 'reranker');
    const { port1, port2 } = new MessageChannel();
    const modelName = 'Xenova/bge-reranker-base';
    port2.on('message', (e) => {
      console.log(e);
    });
    await worker.run(
      {
        dir: dir,
        modelName: modelName,
        options: {
          device: process.env.CI ? 'cpu' : 'dml',
          dtype: 'q4',
        },
        port: port1,
        remoteHost: 'hg-model.tbontop.top',
      },
      { name: 'init', transferList: [port1] },
    );

    const result = await worker.run(
      {
        value: 'hello',
        docs: ['hi', 'hello'],
        dir: dir,
        modelName: modelName,
        options: {
          device: process.env.CI ? 'cpu' : 'dml',
          dtype: 'fp32',
        },
        remoteHost: 'hg-model.tbontop.top',
      },
      { name: 'convert' },
    );
    expect(result.length).eq(2);
    expect(result[0].index).eq(1);
    worker.destroy();
  });
});
