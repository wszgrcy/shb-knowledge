import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { inject, Injector, Signal } from 'static-injector';
import { Text2VecToken, ConfigToken } from '../const';
import { KnowledgeUtilService } from '../knowledge.util.service';
import { v4 } from 'uuid';
import {
  NodeItemType,
  KnowledgeGraphItemType,
  EdgeItemType,
  EdgeItemDefine,
  NodeItemDefine,
  NodeItemNewDefine,
  EdgeItemNewDefine,
} from './define/define';
import { getEdgeName } from './util';
import * as v from 'valibot';
import { GraphKnowledgeConfigInline } from './define/config';
import { GraphKnowledgeUtilService } from './graph.util.service';
import { isTruthy, LogToken } from '@shenghuabi/knowledge/util';
const MAX_LIMIT = 99999;
const FilterEdge = {
  key: 'kind',
  match: {
    value: 'edge',
  },
};
const FilterNode = {
  key: 'kind',
  match: {
    value: 'node',
  },
};
export class GraphHandleService {
  #text2vec = inject(Text2VecToken);
  #config = inject<Signal<GraphKnowledgeConfigInline>>(ConfigToken);
  #util = inject(KnowledgeUtilService);
  #qdClient = inject(QdrantClientService);
  #channel = inject(LogToken);
  #injector = inject(Injector);
  #graphUtil = inject(GraphKnowledgeUtilService);

  /** 拆分节点
   */
  async splitNode(options: { node: string; list: string[] }) {
    await this.#graphUtil.updateContext(async () => {
      const [{ points: nodes }, { points: edges }] = await Promise.all([
        this.#qdClient.scroll(this.#config().activateGraphName, {
          limit: MAX_LIMIT,
          filter: {
            must: [FilterNode, { key: 'name', match: { value: options.node } }],
          },
          with_payload: true,
          with_vector: false,
        }),
        this.#qdClient.scroll(this.#config().activateGraphName, {
          limit: MAX_LIMIT,
          filter: {
            must: [FilterEdge],
            should: [
              { key: 'source', match: { value: options.node } },
              { key: 'target', match: { value: options.node } },
            ],
          },
          with_payload: true,
          with_vector: false,
        }),
      ]);
      const [updateNodes, updateEdges] = await Promise.all([
        Promise.all(
          nodes.flatMap((node) =>
            options.list.map(async (nodeName) => {
              const payload = { ...node.payload!, name: nodeName } as any;
              return {
                payload: payload,
                id: v4(),
              };
            }),
          ),
        ),
        Promise.all(
          edges.flatMap((edge) =>
            options.list.map(async (nodeName) => {
              const payload =
                edge.payload!['source'] === options.node
                  ? ({ ...edge.payload!, source: nodeName } as any)
                  : ({ ...edge.payload!, target: nodeName } as any);
              payload['name'] = getEdgeName(
                payload['source'],
                payload['target'],
              );
              return {
                payload: payload,
                id: v4(),
              };
            }),
          ),
        ),
      ]);
      return {
        upsert: {
          nodes: updateNodes,
          edges: updateEdges,
        },
        delete: {
          nodes: nodes,
          edges: edges,
        },
      };
    });
  }
  /** 合并节点 */
  async mergeNode(options: { node: string; list: string[] }) {
    const listToObj = options.list.reduce(
      (obj, item) => {
        obj[item] = true;
        return obj;
      },
      {} as Record<string, boolean>,
    );
    await this.#graphUtil.updateContext(async () => {
      const [{ points: nodes }, { points: edges }] = await Promise.all([
        this.#qdClient.scroll(this.#config().activateGraphName, {
          limit: MAX_LIMIT,
          filter: {
            must: [FilterNode, { key: 'name', match: { any: options.list } }],
          },
          with_payload: true,
          with_vector: false,
        }),
        this.#qdClient.scroll(this.#config().activateGraphName, {
          limit: MAX_LIMIT,
          filter: {
            must: [FilterEdge],
            should: [
              { key: 'source', match: { any: options.list } },
              { key: 'target', match: { any: options.list } },
            ],
          },
          with_payload: true,
          with_vector: false,
        }),
      ]);
      const [updateNodes, updateEdges] = await Promise.all([
        Promise.all(
          nodes.map(async (node) => {
            const payload = { ...node.payload!, name: options.node } as any;
            return {
              payload: payload,
              id: v4(),
            };
          }),
        ),
        Promise.all(
          edges.map(async (edge) => {
            const hasSource = listToObj[edge.payload!['source'] as any];
            const hasTarget = listToObj[edge.payload!['target'] as any];
            if (hasSource && hasTarget) {
              return undefined;
            }
            const payload = hasSource
              ? ({ ...edge.payload!, source: options.node } as any)
              : ({ ...edge.payload!, target: options.node } as any);
            payload['name'] = getEdgeName(payload['source'], payload['target']);
            return {
              payload: payload,
              id: v4(),
            };
          }),
        ).then((list) => list.filter(isTruthy)),
      ]);
      return {
        upsert: {
          nodes: updateNodes,
          edges: updateEdges,
        },
        delete: {
          nodes: nodes,
          edges: edges,
        },
      };
    });
  }
  /** 虽然可以修改其他的,但是只允许修改描述 */
  async changeNodeDescription(item: NodeItemType) {
    const payload = v.parse(NodeItemDefine, item);
    const id = payload.id;
    delete (payload as any).id;
    await this.#graphUtil.updateContext(async () => ({
      upsert: {
        nodes: [
          {
            id,
            payload: payload,
          },
        ],
      },
    }));
  }
  /**
   * 修改边,如果关系修改了不需要改边 */
  async changeEdge(item: EdgeItemType) {
    const id = item.id;
    const payload = v.parse(EdgeItemDefine, item);
    delete (item as any).id;

    await this.#graphUtil.updateContext(async () => ({
      upsert: {
        edges: [
          {
            id,
            payload: payload,
          },
        ],
      },
    }));
  }
  /** 可以添加节点/边 */
  async addNodeItem(input: KnowledgeGraphItemType) {
    await this.#graphUtil.updateContext(async () => {
      const nodes = (input.nodes ?? []).map((node) => {
        const payload = v.parse(NodeItemNewDefine, node);
        return {
          id: v4(),
          payload: payload,
        };
      });
      const edges = (input.edges ?? []).map((edge) => {
        const payload = v.parse(EdgeItemNewDefine, edge);
        return {
          id: v4(),
          payload: payload,
        };
      });

      return {
        upsert: { nodes, edges },
      };
    });
  }
  /** 删除节点的一条 */
  async deleteNodeItem(item: Pick<NodeItemType, 'id' | 'name'>) {
    await this.#graphUtil.updateContext(async () => {
      const { points } = await this.#qdClient.scroll(
        this.#config().activateGraphName,
        {
          limit: 1,
          filter: {
            must: [FilterNode, { key: 'name', match: { value: item.name } }],
          },
        },
      );

      return {
        delete: {
          nodes: [item],
          edges:
            points.length === 1
              ? {
                  filter: {
                    must: [FilterEdge],
                    should: [
                      { key: 'source', match: { value: item.name } },
                      { key: 'target', match: { value: item.name } },
                    ],
                  },
                }
              : [],
        },
      };
    });
  }
  /** 删除整个边(边不影响节点) */
  async deleteEdge(item: Pick<EdgeItemType, 'id' | 'source' | 'target'>) {
    await this.#graphUtil.updateContext(async () => ({
      delete: {
        edges: [item],
      },
    }));
  }
  /** 删除整个节点(对应边也删除) */
  async deleteNodeByName(name: string) {
    await this.#graphUtil.updateContext(async () => ({
      delete: {
        nodes: {
          filter: {
            must: [FilterNode, { key: 'name', match: { value: name } }],
            should: null,
          },
        },
        edges: {
          filter: {
            must: [FilterEdge],
            should: [
              { key: 'source', match: { value: name } },
              { key: 'target', match: { value: name } },
            ],
          },
        },
      },
    }));
  }
}
