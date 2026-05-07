import * as v from 'valibot';
import * as fs from 'fs/promises';
import { path } from '@cyia/vfs2';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import heicdecode from 'heic-decode';
import { decode } from 'bmp-js';

const BASE64_HEAD_REPLACE_REG = /^data:image\/[\w]+;base64,/;

const InputDefine = v.union([
  v.pipe(
    v.string(),
    v.check((input) => BASE64_HEAD_REPLACE_REG.test(input)),
    v.transform((base64) => {
      const result = base64.match(BASE64_HEAD_REPLACE_REG)!;
      return new Uint8Array(
        Buffer.from(base64.slice(result[0].length), 'base64'),
      );
    }),
  ),
  v.pipe(
    v.string(),
    v.transform((filePath) =>
      fs
        .readFile(path.normalize(filePath))
        .then((buffer) => new Uint8Array(buffer)),
    ),
  ),
  v.pipe(v.custom<Uint8Array>((input) => input instanceof Uint8Array)),
]);
export async function decodeToBuffer(input: string | Uint8Array) {
  const buffer = await v.parse(InputDefine, input);
  return buffer;
}
/**
 * ocr处理用
 * 支持路径,base64,uint8array
 */
export async function convertToRaw(input: string | Uint8Array) {
  const buffer = await decodeToBuffer(input);
  const type = await fileTypeFromBuffer(buffer);
  if (!type) {
    throw new Error(`不支持的图片类型`);
  }
  if (type.mime === 'image/bmp') {
    const data = decode(Buffer.from(buffer));
    const resolvedBuffer = data.data;
    //ABGR =>RGBA
    for (let i = 0; i < resolvedBuffer.length; i += 4) {
      const alpha = resolvedBuffer[i];
      const blue = resolvedBuffer[i + 1];
      const green = resolvedBuffer[i + 2];
      const red = resolvedBuffer[i + 3];
      resolvedBuffer[i] = red;
      resolvedBuffer[i + 1] = green;
      resolvedBuffer[i + 2] = blue;
      resolvedBuffer[i + 3] = (data as any).is_with_alpha ? alpha : 0xff;
    }
    const result = sharp(resolvedBuffer, {
      raw: {
        width: data.width,
        height: data.height,
        channels: 4,
      },
    }).ensureAlpha(1);
    return { type: 'image/png', raw: result };
  } else if (type?.mime === 'image/heic' || type?.mime === 'image/heif') {
    const data = await heicdecode({
      buffer: buffer as any,
    });
    const result = sharp(data.data, {
      raw: {
        width: data.width,
        height: data.height,
        channels: 4,
      },
    });
    return { type: 'image/png', raw: result };
  } else {
    const result = sharp(buffer);
    return { type: type.mime, raw: result };
  }
}
// todo 未来其实应该直接是Buffer转通道颜色
/**
 * 转换为兼容的图片格式
 */
export async function convertToCompatibleBuffer(input: string | Uint8Array) {
  const result2 = await convertToRaw(input);

  return {
    type: result2.type,
    buffer: new Uint8Array(await result2.raw.png().toBuffer()),
  };
}

export function bufferToImageBase64(input: {
  type: string;
  buffer: Uint8Array;
}) {
  return `data:${input.type};base64,${Buffer.from(input.buffer).toString('base64')}`;
}
export function bufferToFileBase64(input: {
  type: string;
  buffer: Uint8Array;
}) {
  return Buffer.from(input.buffer).toString('base64');
}
