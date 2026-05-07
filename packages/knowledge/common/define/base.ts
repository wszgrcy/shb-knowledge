import * as v from 'valibot';
export const BaseKnowledgeConfig = v.object({
  /** 知识库名 */
  name: v.string(),
  activateCollection: v.string(),
});
export type BaseKnowledgeConfigType = v.InferOutput<typeof BaseKnowledgeConfig>;
