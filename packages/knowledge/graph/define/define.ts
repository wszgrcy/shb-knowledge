import { uniqBy } from 'lodash-es';

import * as v from 'valibot';
import { getEdgeName } from '../util';
import { v4 } from 'uuid';
/** 提取的实体 */
export const ENTITY_DEFINE = v.object({
  name: v.string(),
  description: v.optional(v.string(), ''),
  /** 实体类型 */
  type: v.string(),
});
/** 联系 */
export const ENTITY_RELATION_DEFINE = v.object({
  source: v.string(),
  target: v.string(),
  description: v.optional(v.string(), ''),
  strength: v.optional(v.number(), 5),
  keywords: v.optional(
    v.union([
      v.pipe(
        v.string(),
        v.transform((str) => str.split(',').map((item) => item.trim())),
      ),
      v.array(v.string()),
    ]),
  ),
});

// 一个实体可能有多个重名的.
/** 提取定义 */
export const EntityExtraDefine = v.object({
  entity: v.pipe(
    v.nullish(v.array(ENTITY_DEFINE), []),
    v.transform((list) =>
      uniqBy(
        (list || []).filter((item) => !!item.name && !!item.description),
        (item) => `${item.name}|${item.type}|${item.description}`,
      ),
    ),
  ),
  entity_relation: v.pipe(
    v.nullish(v.array(ENTITY_RELATION_DEFINE), []),
    v.transform((list) =>
      uniqBy(
        (list || []).filter(
          (item) => !!item.source && !!item.target && !!item.description,
        ),
        (item) => `${item.source}|${item.target}|${item.description}`,
      ),
    ),
  ),
  keyword: v.pipe(
    v.nullish(v.array(v.string()), []),
    v.transform((item) => item.map((item) => item.trim())),
  ),
});
export type EntityExtractType = v.InferOutput<typeof EntityExtraDefine>;

export type NodeExtract = EntityExtractType['entity'][number];
/** 完整的graph节点项 */
export const NodePayloadDefine = v.object({
  ...ENTITY_DEFINE.entries,
  kind: v.optional(v.literal('node'), 'node'),
  id: v.string(),
  chunkId: v.string(),
  fileName: v.string(),
});

export const NodeItemDefine = v.pipe(
  v.omit(NodePayloadDefine, ['kind']),
  v.transform((data) => ({ ...data, kind: 'node' as const })),
);
export const NodePayloadNewDefine = v.pipe(
  v.object({
    ...v.omit(NodePayloadDefine, ['id']).entries,
    embeddingChunk: v.string(),
  }),
);
export const NodeItemNewDefine = v.pipe(
  v.object({
    ...v.omit(NodePayloadDefine, ['kind', 'id']).entries,
    id: v.optional(NodePayloadDefine.entries.id, () => v4()),
  }),
  v.transform((data) => ({ ...data, kind: 'node' as const })),
);
export type NodeItemType = v.InferInput<typeof NodeItemDefine>;
export type NodeItemNewType = v.InferInput<typeof NodeItemNewDefine>;

export type EdgeExtract = EntityExtractType['entity_relation'][number];
export const EdgePayloadDefine = v.object({
  ...ENTITY_RELATION_DEFINE.entries,
  chunkId: v.string(),
  kind: v.optional(v.literal('edge'), 'edge'),
  name: v.string(),
  fileName: v.string(),
  id: v.string(),
});
export const EdgeItemDefine = v.pipe(
  v.omit(EdgePayloadDefine, ['kind', 'name']),
  v.transform((data) => ({
    ...data,
    name: getEdgeName(data.source, data.target),
    kind: 'edge' as const,
  })),
);
export const EdgePayloadNewDefine = v.pipe(
  v.object({
    ...v.omit(EdgePayloadDefine, ['name', 'id']).entries,
    embeddingChunk: v.string(),
  }),
  v.transform((data) => ({
    ...data,
    name: getEdgeName(data.source, data.target),
  })),
);
export const EdgeItemNewDefine = v.pipe(
  v.object({
    ...v.omit(EdgePayloadDefine, ['kind', 'name', 'id']).entries,
    id: v.optional(NodePayloadDefine.entries.id, () => v4()),
  }),
  v.transform((data) => ({
    ...data,
    name: getEdgeName(data.source, data.target),
    kind: 'edge' as const,
  })),
);
export type EdgePayload = v.InferOutput<typeof EdgePayloadDefine>;
export type EdgeItemType = v.InferInput<typeof EdgeItemDefine>;
export type EdgeItemNewType = v.InferInput<typeof EdgeItemNewDefine>;
export type EdgeQueryPayload = EdgePayload & { embeddingChunk: string };
// export type EdgeAttr = {
//   list: EdgeItem[];
// };
export interface RagExtraKeyword {
  high_level_keywords: string[];
  low_level_keywords: string[];
}

export const KnowledgeGraphCreateDefine = v.object({
  fileName: v.string(),
  chunkId: v.string(),
  nodeList: v.optional(v.array(ENTITY_DEFINE), []),
  edgeList: v.optional(v.array(ENTITY_RELATION_DEFINE), []),
});

export type KnowledgeGraphItemType = {
  nodes?: NodeItemNewType[];
  edges?: EdgeItemNewType[];
};
/** 属性分割,因为有一部分没id的 */
export type NodePayload = v.InferOutput<typeof NodePayloadDefine>;
export type NodeQueryPayload = NodePayload & { embeddingChunk: string };
export type GraphNodeAttr = {
  list: NodePayload[];
  name: string;
};
export type GraphEdgeAttr = {
  list: EdgePayload[];
  name: string;
  source: string;
  target: string;
};

export const KeywordPayloadNewDefine = v.pipe(
  v.object({
    kind: v.optional(v.literal('keyword'), 'keyword'),
    keyword: v.string(),
    chunkId: v.string(),
    fileName: v.string(),
  }),
);
