import { BaseKnowledgeConfig } from '../../common/define/base';
import { getActivateCollectionName } from '../../const';
import { NormalCollectionDefine } from '../../normal/define/config';
import * as v from 'valibot';

export const DictCollectionDefine = NormalCollectionDefine;

export const DictKnowledgeConfigDefine = v.pipe(
  v.object({
    ...BaseKnowledgeConfig.entries,
    type: v.optional(v.literal('dict'), 'dict'),
    collectionList: v.array(DictCollectionDefine),
    /** 词条提取 */
    extractorWord: v.optional(v.boolean()),
    /** 图像识别 */
    useOcr: v.optional(v.boolean()),
  }),
  v.transform((item) => ({
    ...item,
    /** 激活的普通知识库(文件切片) */
    activateName: getActivateCollectionName(item.name),
  })),
);

export type DictKnowledgeConfig = v.InferInput<
  typeof DictKnowledgeConfigDefine
>;
export type DictKnowledgeConfigInline = v.InferOutput<
  typeof DictKnowledgeConfigDefine
>;
export type DictCollectionInput = v.InferInput<typeof DictCollectionDefine>;
export type DictCollectionInlineType = v.InferOutput<
  typeof DictCollectionDefine
>;
