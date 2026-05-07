import { path } from '@cyia/vfs2';
import Tinypool from 'tinypool';
import { expect } from 'chai';
import { pathToFileURL } from 'node:url';
function createWorker(count: number) {
  const instance = new Tinypool({
    filename: pathToFileURL(
      path.join(process.cwd(), 'test-dist/worker/wait.mjs'),
    ).href,
    maxThreads: count,
    maxQueue: 9999,
    concurrentTasksPerWorker: 1,
    useAtomics: true,
  });
  return instance;
}
describe.skip('原子测试', () => {
  for (let index = 0; index < 1; index++) {
    it('原子测试', async () => {
      const num = 8;
      const worker = createWorker(num);
      // int32 4字节
      const buffer = new SharedArrayBuffer(8);
      const list = new Array(num).fill(0);
      const result = await Promise.all(
        list.map((_, index) => {
          const { port1, port2 } = new MessageChannel();
          port2.on('message', (value) => {
            console.log(index, value);
          });
          return worker
            .run(
              {
                port: port1,
                buffer: buffer,
              },
              { runtime: 'worker_threads', transferList: [port1] },
            )
            .then((a) => {
              port2.close();
              return a;
            });
        }),
      );
      const mainCount = result.filter((item) => item === 1).length;
      expect(mainCount).eq(1);
      await worker.destroy();
    });
  }
});
