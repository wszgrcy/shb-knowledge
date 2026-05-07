import * as v from 'valibot';
import { EmbeddingTemplateDefine } from '../../common/define/embedding';
import { BaseKnowledgeConfig } from '../../common/define/base';
import { getActivateCollectionName, getGraphCollectionName } from '../../const';
export const GraphCollectionDefine = v.pipe(
  v.object({
    collectionName: v.string(),
    size: v.number(),
    embeddingTemplate: v.optional(
      v.object({
        entry: v.optional(EmbeddingTemplateDefine),
        node: v.optional(EmbeddingTemplateDefine),
        edge: v.optional(EmbeddingTemplateDefine),
      }),
    ),
  }),
  v.transform((collection) => ({
    ...collection,
    graphCollectionName: getGraphCollectionName(collection.collectionName),
  })),
);
export const GraphKnowledgeConfigDefine = v.pipe(
  v.object({
    ...BaseKnowledgeConfig.entries,
    type: v.optional(v.literal('normal-graph'), 'normal-graph'),
    maxChunkAsync: v.number(),
    collectionList: v.array(GraphCollectionDefine),
  }),
  v.transform((input) => ({
    ...input,
    /** 激活的普通知识库(文件切片) */
    activateName: getActivateCollectionName(input.name),
    /** 激活的图数据库 */
    activateGraphName: getActivateCollectionName(
      getGraphCollectionName(input.name),
    ),
  })),
);

export type GraphKnowledgeConfig = v.InferInput<
  typeof GraphKnowledgeConfigDefine
>;
export type GraphKnowledgeConfigInline = v.InferOutput<
  typeof GraphKnowledgeConfigDefine
>;
export type GraphCollectionInput = v.InferInput<typeof GraphCollectionDefine>;
export type GraphCollectionInlineType = v.InferOutput<
  typeof GraphCollectionDefine
>;
