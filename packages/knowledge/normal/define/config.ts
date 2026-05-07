import * as v from 'valibot';
import { EmbeddingTemplateDefine } from '../../common/define/embedding';
import { BaseKnowledgeConfig } from '../../common/define/base';
import { getActivateCollectionName } from '../../const';
export const NormalCollectionDefine = v.object({
  collectionName: v.string(),
  embeddingTemplate: v.optional(
    v.object({
      entry: v.optional(EmbeddingTemplateDefine),
    }),
  ),
  size: v.number(),
});

export const NormalKnowledgeConfigDefine = v.pipe(
  v.object({
    ...BaseKnowledgeConfig.entries,
    type: v.optional(v.literal('normal'), 'normal'),
    collectionList: v.array(NormalCollectionDefine),
  }),
  v.transform((item) => ({
    ...item,
    /** 激活的普通知识库(文件切片) */
    activateName: getActivateCollectionName(item.name),
  })),
);

export type NormalKnowledgeConfig = v.InferInput<
  typeof NormalKnowledgeConfigDefine
>;
export type NormalKnowledgeConfigInline = v.InferOutput<
  typeof NormalKnowledgeConfigDefine
>;
export type NormalCollectionInput = v.InferInput<typeof NormalCollectionDefine>;
export type NormalCollectionInlineType = v.InferOutput<
  typeof NormalCollectionDefine
>;
