import * as v from 'valibot';
export const FileChunkPayloadDefine = v.object({
  chunk: v.string(),
  fileName: v.string(),
  loc: v.custom<{ lines: { from: number; to: number } }>(Boolean),
  hash: v.string(),
  embeddingChunk: v.string(),
});
export type FileChunkPayload = v.InferOutput<typeof FileChunkPayloadDefine>;
