import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { inject, Signal } from 'static-injector';
import { QueryContext } from './type';
import { ConfigToken, ReRankerToken, Text2VecToken } from '../const';
import { GraphLocalService } from './graph.local.service';
import { QueryParamsToken } from './const';
import { differenceBy, uniqBy } from 'lodash-es';
import { getEdgeStrList, getNodeStrList } from './util/graph-util';
import {
  formatEdgeAttr2,
  FormatGraphEdgeAttr,
  FormatGraphNodeAttr,
  formatNodeAttr2,
} from './util/format-attr';
import { FileChunkPayload } from '../common/define/chunk';
import { GraphKnowledgeConfigInline } from './define/config';
import { GraphRelationQueryDefine } from './define/query';
import * as v from 'valibot';
import { EdgeQueryPayload, NodeQueryPayload } from './define';
export class GraphQueryService {
  #qdClient = inject(QdrantClientService);
  #config = inject<Signal<GraphKnowledgeConfigInline>>(ConfigToken);
  #graphChange = inject(GraphLocalService);
  #queryParams = inject(QueryParamsToken);
  #text2vec = inject(Text2VecToken);
  #reranker = inject(ReRankerToken);

  /** 返回限制索引 */
  #listLimit<T>(
    list: T[],
    strListFn: (list: T, index: number) => string,
    limit: number,
  ) {
    let count = 0;
    const strList = list.map(strListFn);
    for (let i = 0; i < strList.length; i++) {
      const str = strList[i];
      count += str.length;
      if (count > limit) {
        return list.slice(0, i);
      }
    }
    return list;
  }
  #contextLimit<
    T extends { nodes: any[]; edges: any[]; chunks: FileChunkPayload[] },
  >(context: T): T {
    return {
      nodes: this.#listLimit(
        context.nodes,
        (item: any, i) => getNodeStrList(item, i).join('|'),
        this.#queryParams.lengthLimit.node,
      ),
      edges: this.#listLimit(
        context.edges,
        (item: any, i) => getEdgeStrList(item, i).join('|'),
        this.#queryParams.lengthLimit.edge,
      ),
      chunks: this.#listLimit(
        context.chunks,
        (list) => list.chunk,
        this.#queryParams.lengthLimit.chunk,
      ),
    } as any;
  }
  async #queryGraphCollection<T>(content: string, kind: 'node' | 'edge') {
    return this.#qdClient
      .search(this.#config().activateGraphName, {
        limit: this.#queryParams.topK * this.#reranker.getQueryRatio(),
        vector: {
          name: 'chunk',
          vector: await this.#text2vec(
            content,
            this.#config().activateCollection,
          ),
        },
        filter: {
          must: {
            key: 'kind',
            match: {
              value: kind,
            },
          },
        },
        with_payload: true,
        // with_lookup: true,
      })
      .then((item) =>
        item.map((item) => ({ ...item.payload, id: item.id }) as T),
      );
  }

  async #findChunkDataById(ids: string[]) {
    return this.#qdClient
      .retrieve(this.#config().activateName, { ids: ids, with_payload: true })
      .then((item) =>
        item.map(
          (item) =>
            ({
              ...item.payload,
              knowledge: this.#config().name,
            }) as any as FileChunkPayload,
        ),
      );
  }
  #getEdgeByNode(nodes: NodeQueryPayload[]) {
    const list = this.#graphChange.getEdgeByNode(nodes);
    return this.#qdClient
      .retrieve(this.#config().activateGraphName, {
        ids: list.map((item) => item.id),
      })
      .then((list) =>
        list.map(
          (item) => ({ ...item.payload, id: item.id }) as EdgeQueryPayload,
        ),
      );
  }
  #getNodeByEdge(edges: EdgeQueryPayload[]) {
    const list = this.#graphChange.getNodeByEdge(edges);
    return this.#qdClient
      .retrieve(this.#config().activateGraphName, {
        ids: list.map((item) => item.id),
      })
      .then((list) =>
        list.map(
          (item) => ({ ...item.payload, id: item.id }) as NodeQueryPayload,
        ),
      );
  }
  async #queryLocal(keywords: string) {
    /** 查询返回的节点组 */
    const nodeGroupResult = await this.#queryGraphCollection<NodeQueryPayload>(
      keywords,
      'node',
    );
    const chunkResult = await this.#findChunkDataById(
      nodeGroupResult.map((item) => item.chunkId),
    );

    return {
      nodes: nodeGroupResult,
      edges: await this.#getEdgeByNode(nodeGroupResult),
      chunks: chunkResult,
    };
  }
  async #queryGlobal(keywords: string) {
    /** 查询返回的边组 */
    const edgeGroupResult = await this.#queryGraphCollection<EdgeQueryPayload>(
      keywords,
      'edge',
    );
    const chunkResult = await this.#findChunkDataById(
      edgeGroupResult.map((item) => item!['chunkId']),
    );

    return {
      nodes: await this.#getNodeByEdge(edgeGroupResult),
      edges: edgeGroupResult,
      chunks: chunkResult,
    };
  }
  async query(params: { node?: string; edge?: string }, question: string) {
    params = v.parse(GraphRelationQueryDefine, params);

    await this.#graphChange.loadDataInitGraph$$();

    let context: QueryContext;
    if (params.node && params.edge) {
      const context1 = await this.#queryLocal(params.node!);
      const context2 = await this.#queryGlobal(params.edge!);
      // 先合并,然后在排序,然后在截取
      const ctx2NodeExtra = differenceBy(
        context2.nodes,
        context1.nodes,
        (item) => item.id,
      );

      const ctx1EdgeExtra = differenceBy(
        context1.edges,
        context2.edges,
        (item) => item.id,
      );

      // 其实可以保留前20%的结果,后80%排序
      context = {
        nodes: [...context1.nodes, ...ctx2NodeExtra],
        edges: [...context2.edges, ...ctx1EdgeExtra],
        chunks: uniqBy(
          [...context1.chunks, ...context2.chunks],
          (a) => a.chunk,
        ),
      };
    } else if (params.node) {
      context = await this.#queryLocal(params.node!);
    } else if (params.edge) {
      context = await this.#queryGlobal(params.edge!);
    } else {
      throw new Error('');
    }
    const nodeSortedList = await this.#reranker.run({
      value: question,
      docs: context.nodes.map((item) => item.embeddingChunk),
    });
    const nodeSorted = nodeSortedList
      .slice(0, Math.ceil(nodeSortedList.length * 0.3))
      .reduce(
        (obj, item) => {
          const data = context.nodes[item.index];
          obj[data.name] ??= [];
          obj[data.name].push({ data, score: item.score });
          return obj;
        },
        {} as Record<string, { data: NodeQueryPayload; score: number }[]>,
      );

    const edgeSortList = await this.#reranker.run({
      value: question,
      docs: context.edges.map((item) => item.embeddingChunk),
    });
    const edgeSorted = edgeSortList
      .slice(0, Math.ceil(nodeSortedList.length * 0.3))
      .reduce(
        (obj, item) => {
          const data = context.edges[item.index];
          obj[data.name] ??= [];
          obj[data.name].push({ data, score: item.score });
          return obj;
        },
        {} as Record<string, { data: EdgeQueryPayload; score: number }[]>,
      );

    return this.#contextLimit({
      nodes: Object.values(nodeSorted)
        .reduce((allList: FormatGraphNodeAttr[], list) => {
          let length = 0;
          const index = list.findIndex((value, index) => {
            length += value.data.description.length;
            return length > this.#queryParams.lengthLimit.nodeDescription;
          });
          allList.push(
            formatNodeAttr2(list.slice(0, index == -1 ? list.length : index)),
          );
          return allList;
        }, [])
        .sort((a, b) => b.degree - a.degree),
      edges: Object.values(edgeSorted)
        .reduce((allList, list) => {
          let length = 0;
          const index = list.findIndex((value) => {
            length += value.data.description.length;
            return length > this.#queryParams.lengthLimit.nodeDescription;
          });
          allList.push(
            formatEdgeAttr2(list.slice(0, index == -1 ? list.length : index)),
          );
          return allList;
        }, [] as FormatGraphEdgeAttr[])
        .sort((a, b) => b.degree - a.degree),
      chunks: (
        await this.#reranker.run({
          value: question,
          docs: context.chunks.map((item) => item.embeddingChunk),
        })
      ).map((item) => context.chunks[item.index]),
    });
  }

  async searchNode(str: string, selectedList: string[]) {
    await this.#graphChange.loadDataInitGraph$$();

    const limit = 20;
    const list: string[] = [];
    // todo trie?
    for (const nodeName of this.#graphChange.getGraph().nodes()) {
      if (!selectedList.includes(nodeName) && nodeName.includes(str)) {
        list.push(nodeName);
        if (limit === list.length) {
          return list;
        }
      }
    }

    return list;
  }

  async getFileNameList() {
    const result = await this.#qdClient.queryGroups(
      this.#config().activateName,
      {
        limit: 9999,
        group_by: 'fileName',
        group_size: 1,
        with_payload: [],
      },
    );
    return result.groups;
  }
  async getChunkContent(fileName: string) {
    const { points } = await this.#qdClient.query(this.#config().activateName, {
      limit: 9999,
      filter: {
        must: {
          key: 'fileName',
          match: { value: fileName },
        },
      },
      with_payload: true,
    });

    return points.map((item) => ({
      ...item,
      payload: {
        ...item.payload,
        knowledge: this.#config().name,
      } as FileChunkPayload & { knowledge: string },
    }));
  }

  async getGraphData() {
    await this.#graphChange.loadDataInitGraph$$();
    return this.#graphChange.getGraph().export();
  }

  async queryNode(list: string[], options: { nodeSizeLimit: number }) {
    return this.#qdClient
      .scroll(this.#config().activateGraphName, {
        limit: options.nodeSizeLimit,
        filter: {
          must: [
            {
              key: 'kind',
              match: {
                value: 'node',
              },
            },
            {
              key: 'name',
              match: {
                any: list,
              },
            },
          ],
        },
        with_payload: true,
        // with_lookup: true,
      })
      .then((item) => item.points);
  }

  async fuzzyQueryNode(
    content: string,
    options: {
      /** 限制多少个节点 */
      nodeLimit: number;
      /** 精度 */
      score: number;
      /** 限制每个节点多少信息 */
      nodeSizeLimit: number;
    },
  ) {
    return this.#qdClient
      .searchPointGroups(this.#config().activateGraphName, {
        limit: options.nodeLimit,
        score_threshold: options.score,
        vector: {
          name: 'chunk',
          vector: await this.#text2vec(
            content,
            this.#config().activateCollection,
          ),
        },
        group_by: 'name',
        group_size: options.nodeSizeLimit,
        filter: {
          must: {
            key: 'kind',
            match: {
              value: 'node',
            },
          },
        },
        with_payload: true,
        // with_lookup: true,
      })
      .then((item) => item.groups);
  }
}
