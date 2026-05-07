import { ImageAdjustType, Ocr, ModelConfig } from '@shenghuabi/knowledge/ocr';
import { createNormalizeVfs, path } from '@cyia/vfs2';
// import * as ort from 'onnxruntime-node';
import { MessagePort } from 'worker_threads';
import { getUniqueObjectKey } from '@shenghuabi/knowledge/util';
import { downloadFile } from '@cyia/dl';
let key!: string;
let ocrInstance: ReturnType<(typeof Ocr)['create']>;
const BaseUrl =
  'https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/master/onnx/PP-OCRv4';

const DictUrl =
  'https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/master/paddle/PP-OCRv4';
async function init(ocrConfig: {
  key: string;
  modelDir: string;
  port: MessagePort;
}) {
  const messageCb = (message: any) => {
    ocrConfig.port.postMessage({ type: 'progress', message });
  };
  const modelConfig = ModelConfig.find((item) => item.key === ocrConfig.key)!;
  const fs = createNormalizeVfs({ dir: ocrConfig.modelDir });
  // 自动下载模型
  const absDetectionPath = path.join(ocrConfig.modelDir, modelConfig.det);
  if (!(await fs.exists(modelConfig.det))) {
    await downloadFile(`${BaseUrl}/${modelConfig.det}`, {
      savePath: absDetectionPath,
      message: messageCb,
    });
  }
  const absRecognitionPath = path.join(ocrConfig.modelDir, modelConfig.rec);
  if (!(await fs.exists(modelConfig.rec))) {
    await downloadFile(`${BaseUrl}/${modelConfig.rec}`, {
      savePath: absRecognitionPath,
      message: messageCb,
    });
  }
  const absDictionaryPath = path.join(ocrConfig.modelDir, modelConfig.dict);
  if (!(await fs.exists(modelConfig.dict))) {
    await downloadFile(`${DictUrl}/${modelConfig.dict}`, {
      savePath: absDictionaryPath,
      message: messageCb,
    });
  }
}
// 改为init和convert
async function convert(input: {
  filePath: string | Uint8Array;
  ocrConfig: { key: string; modelDir: string; device?: 'dml' | 'cuda' | 'cpu' };
  options?: ImageAdjustType;
}) {
  const inputKey = getUniqueObjectKey(input.ocrConfig);
  if (key !== inputKey) {
    const modelConfig = ModelConfig.find(
      (item) => item.key === input.ocrConfig.key,
    )!;
    // 自动下载模型
    const absDetectionPath = path.join(
      input.ocrConfig.modelDir,
      modelConfig.det,
    );
    const absRecognitionPath = path.join(
      input.ocrConfig.modelDir,
      modelConfig.rec,
    );
    const absDictionaryPath = path.join(
      input.ocrConfig.modelDir,
      modelConfig.dict,
    );
    ocrInstance = Ocr.create({
      onnxOptions: {
        executionProviders: input.ocrConfig.device
          ? [input.ocrConfig.device]
          : ['dml', 'cuda', 'cpu'],
        executionMode: 'parallel',
      },
      models: {
        detectionPath: absDetectionPath,
        recognitionPath: absRecognitionPath,
        dictionaryPath: absDictionaryPath,
      },
    });
    key = inputKey;
  }
  return (await ocrInstance).convert(input.filePath, input.options);
}

export { init, convert };
