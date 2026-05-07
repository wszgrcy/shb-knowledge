import { textAnalyse } from './text-analyse';

export function bufferDecodeToText(
  buffer: Uint8Array,
  metadata?: { path?: string },
) {
  const type = textAnalyse(buffer);
  const decoder = new TextDecoder(type, { fatal: true });
  try {
    return decoder.decode(buffer);
  } catch (error) {
    throw new Error(`尝试使用 ${type} 编码解析失败;${metadata?.path ?? ''}`);
  }
}
