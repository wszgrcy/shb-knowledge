import BaseOcr, {
  ModelCreateOptions,
  registerBackend,
} from '@gutenye/ocr-common';
import { splitIntoLineImages } from '@gutenye/ocr-common/splitIntoLineImages';
import { ImageRaw } from './ImageRaw';
import { FileUtils } from './FileUtils';
import { InferenceSession } from 'onnxruntime-node';
import fs from 'fs/promises';
import { path } from '@cyia/vfs2';
import { convertToRaw } from '../image';
import * as v from 'valibot';
const ImageAdjustDefine = v.object({
  padding: v.pipe(
    v.optional(
      v.union([
        v.pipe(
          v.number(),
          v.transform((item) => ({
            top: item,
            left: item,
            right: item,
            bottom: item,
          })),
        ),
        v.object({
          left: v.number(),
          right: v.number(),
          top: v.number(),
          bottom: v.number(),
        }),
      ]),
      { top: 50, right: 50, left: 50, bottom: 50 },
    ),
  ),
  maxSideLen: v.optional(v.union([v.pipe(v.number())]), 1920),
  // threshold: v.optional(v.union([v.pipe(v.number())]), 0.3),
});
export type ImageAdjustType = v.InferInput<typeof ImageAdjustDefine>;
registerBackend({
  FileUtils,
  ImageRaw,
  InferenceSession,
  splitIntoLineImages,
  defaultModels: undefined,
});

async function convert(
  this: BaseOcr,
  input: string | Uint8Array,
  options: ImageAdjustType = {},
) {
  const resolveOptions = v.parse(ImageAdjustDefine, options);
  //100 80 0.8
  // 50 40
  let { raw } = await convertToRaw(input);
  const metadata = await raw.metadata();
  const maxSize = Math.max(metadata.width!, metadata.height!);
  if (maxSize > resolveOptions.maxSideLen) {
    let ratio = metadata.width! / metadata.height!;
    ratio = ratio > 1 ? 1 / ratio : ratio;
    raw = raw.resize({
      width: Math.round(
        maxSize === metadata.width!
          ? resolveOptions.maxSideLen
          : ratio * resolveOptions.maxSideLen,
      ),
      height: Math.round(
        maxSize === metadata.height!
          ? resolveOptions.maxSideLen
          : ratio * resolveOptions.maxSideLen,
      ),
    });
  }
  raw = raw.extend({ ...resolveOptions.padding, background: '#fff' });
  raw = raw.ensureAlpha(1);
  return this.detect(raw as any);
}
export class Ocr extends BaseOcr {
  static override async create(options: ModelCreateOptions = {}) {
    const ocr = await BaseOcr.create(options);
    if (options.debugOutputDir) {
      await fs.mkdir(path.normalize(options.debugOutputDir), {
        recursive: true,
      });
    }
    (ocr as any).convert = convert.bind(ocr);
    return ocr as BaseOcr & { convert: typeof convert };
  }
}
