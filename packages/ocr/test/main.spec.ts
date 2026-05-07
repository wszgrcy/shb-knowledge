import { path } from '@cyia/vfs2';
import { Ocr } from '../ocr';
import { expect } from 'chai';
import { ModelConfig } from '../model-config';
import { existsSync } from 'node:fs';
describe('ocr', () => {
  // 仅检测一次
  it.skip('模型检测', () => {
    const modelsDir = path.join(process.cwd(), 'bin/models');
    for (const item of ModelConfig) {
      expect(existsSync(path.join(path.join(modelsDir), item.cls)));
      expect(existsSync(path.join(path.join(modelsDir), item.det)));
      expect(existsSync(path.join(path.join(modelsDir), item.dict)));
      expect(existsSync(path.join(path.join(modelsDir), item.rec)));
    }
  });
  const list = ['bmp', 'gif', 'heic', 'jpg', 'png', 'tif', 'webp', 'avif'];
  for (const item of list) {
    it(item, async () => {
      const cwd = path.join(
        process.cwd(),
        `./packages/ocr/test/fixture/1.${item}`,
      );
      const modelsDir = path.join(process.cwd(), 'bin/models');
      const ocr = await Ocr.create({
        onnxOptions: {
          executionProviders: ['dml', 'cpu'],
        },
        models: {
          detectionPath: path.join(modelsDir, 'ch_PP-OCRv4_det_infer.onnx'),
          recognitionPath: path.join(modelsDir, 'rec_ch_PP-OCRv4_infer.onnx'),
          dictionaryPath: path.join(modelsDir, 'dict_chinese.txt'),
        },
      });

      const result = await ocr.convert(cwd);
      // console.log(result);
      expect(result[0].text).eq('测试文本');
      expect(result[1].text).eq('0123456789');
    });
  }

  it.skip('测试1', async () => {
    const cwd = path.join(
      process.cwd(),
      `./packages/ocr/test/fixture/卡片测试.nt.png`,
    );
    const modelsDir = path.join(process.cwd(), 'bin/models');
    const ocr = await Ocr.create({
      onnxOptions: {
        executionProviders: ['dml', 'cpu'],
      },
      models: {
        detectionPath: path.join(modelsDir, 'ch_PP-OCRv4_det_infer.onnx'),
        recognitionPath: path.join(modelsDir, 'rec_ch_PP-OCRv4_infer.onnx'),
        dictionaryPath: path.join(modelsDir, 'dict_chinese.txt'),
      },
    });

    const result = await ocr.convert(cwd, { padding: 100, maxSideLen: 2048 });
    console.log(result);
    // expect(result[0].text).eq('测试文本');
    // expect(result[1].text).eq('0123456789');
  });
});
