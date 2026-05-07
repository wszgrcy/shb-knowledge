import * as v from 'valibot';
export const ArticlePayload = v.object({
  fileHash: v.string(),
  fullName: v.string(),
  name: v.string(),
  dir: v.string(),
  chunk: v.string(),
  hash: v.string(),
  loc: v.custom<{ lines: { from: number; to: number } }>(Boolean),
});
export type ArticlePayloadType = v.InferOutput<typeof ArticlePayload>;
