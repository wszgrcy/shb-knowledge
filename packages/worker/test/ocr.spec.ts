import { createNormalizeVfs, path } from '@cyia/vfs2';
import Tinypool from 'tinypool';
import { expect } from 'chai';
import { init } from '../ocr';
import { pathToFileURL } from 'url';

function createWorker(count: number) {
  const instance = new Tinypool({
    filename: pathToFileURL(
      path.join(process.cwd(), 'test-dist/worker/ocr.mjs'),
    ).href,
    maxThreads: count,
    maxQueue: 9999,
    concurrentTasksPerWorker: 1,
  });
  return instance;
}

describe('ocr', () => {
  const dir = path.join(process.cwd(), 'bin', 'ocr');
  // 单独测试
  before(async () => {
    await init({ modelDir: dir, key: 'ch_mobile' });
  });
  it.skip('init', async () => {
    const worker = createWorker(1);
    const { port1, port2 } = new MessageChannel();
    port2.on('message', (value) => {
      console.log('信息', value);
    });

    const result = await worker.run(
      {
        key: 'ch_mobile',
        modelDir: dir,
        port: port1,
      },
      { name: 'init', runtime: 'worker_threads', transferList: [port1] },
    );
    port2.close();

    const fs = createNormalizeVfs({ dir: dir });
    const exists1 = await fs.exists('det/ch_PP-OCRv4_det_mobile.onnx');
    const exists2 = await fs.exists('rec/ch_PP-OCRv4_rec_mobile.onnx');
    const exists3 = await fs.exists(
      'rec/ch_PP-OCRv4_rec_mobile/ppocr_keys_v1.txt',
    );
    expect(exists1).eq(true);
    expect(exists2).eq(true);
    expect(exists3).eq(true);
  });
  it('convert', async () => {
    const worker = createWorker(1);
    const { port1, port2 } = new MessageChannel();
    const filePath = path.join(
      process.cwd(),
      `./packages/ocr/test/fixture/1.png`,
    );

    await worker.run(
      {
        key: 'ch_mobile',
        modelDir: dir,
        port: port1,
      },
      { name: 'init', runtime: 'worker_threads', transferList: [port1] },
    );
    port1.close();
    const result = await worker.run(
      {
        filePath,
        ocrConfig: {
          key: 'ch_mobile',
          modelDir: dir,
        },
      },
      { name: 'convert', runtime: 'worker_threads' },
    );
    expect(result[0].text).eq('测试文本');
    expect(result[1].text).eq('0123456789');
  });
});
