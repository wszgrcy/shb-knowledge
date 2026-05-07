import * as v from 'valibot';
export const GraphRelationQueryDefine = v.pipe(
  v.object({
    node: v.optional(v.string()),
    edge: v.optional(v.string()),
  }),
  v.forward(
    v.partialCheck(
      [['node'], ['edge']],
      (input) =>
        typeof input.node === 'string' || typeof input.edge === 'string',
      '节点或边必须存在一个',
    ),
    ['node'],
  ),
);
