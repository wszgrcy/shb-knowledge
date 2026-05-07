import * as v from 'valibot';
import { EmbeddingTemplateDefine } from '../../common/define/embedding';
import { BaseKnowledgeConfig } from '../../common/define/base';
import { getActivateCollectionName } from '../../const';
export const ArticleCollectionDefine = v.object({
  collectionName: v.string(),
  embeddingTemplate: v.optional(
    v.object({
      entry: v.optional(EmbeddingTemplateDefine),
    }),
  ),
  size: v.number(),
});

export const ArticleKnowledgeConfigDefine = v.pipe(
  v.object({
    ...BaseKnowledgeConfig.entries,
    type: v.optional(v.literal('article'), 'article'),
    collectionList: v.array(ArticleCollectionDefine),
  }),
  v.transform((item) => ({
    ...item,
    /** 激活的普通知识库(文件切片) */
    activateName: getActivateCollectionName(item.name),
  })),
);

export type ArticleKnowledgeConfig = v.InferInput<
  typeof ArticleKnowledgeConfigDefine
>;
export type ArticleKnowledgeConfigInline = v.InferOutput<
  typeof ArticleKnowledgeConfigDefine
>;
export type ArticleCollectionInput = v.InferInput<
  typeof ArticleCollectionDefine
>;
export type ArticleCollectionInlineType = v.InferOutput<
  typeof ArticleCollectionDefine
>;
