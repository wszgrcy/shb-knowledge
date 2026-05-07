import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { computed, inject, signal, Signal, untracked } from 'static-injector';
import { ConfigToken } from '../const';
import Graph from 'graphology';
import {
  EdgeItemNewDefine,
  EdgeItemNewType,
  EdgeItemType,
  EdgePayload,
  GraphEdgeAttr,
  GraphNodeAttr,
  KnowledgeGraphItemType,
  NodeItemNewDefine,
  NodeItemNewType,
  NodeItemType,
  NodePayload,
} from './define/define';
import { Attributes } from 'graphology-types';
import * as v from 'valibot';
import { getEdgeName } from './util';

import { GraphKnowledgeConfigInline } from './define/config';
import { LogToken } from '@shenghuabi/knowledge/util';
// 这个应该持久化,因为图初始化一次很麻烦
export class GraphLocalService {
  #qdClient = inject(QdrantClientService);
  #config = inject<Signal<GraphKnowledgeConfigInline>>(ConfigToken);
  #limit = 5000;
  #graph!: Graph<GraphNodeAttr, GraphEdgeAttr, Attributes>;
  #log = inject(LogToken);
  update$ = signal(0);
  graphExport$$ = computed(() => {
    this.update$();
    return this.#graph.export();
  });
  getGraph() {
    return this.#graph;
  }
  loadDataInitGraph$$ = computed(() => {
    this.initGraph();
    return untracked(() => this.loadingData());
  });
  /** 只初始化数据 */
  initGraph() {
    this.#graph = new Graph();
    return this.#graph;
  }
  #getEdgesFromSource(name: string) {
    try {
      return this.#graph.outEdges(name);
    } catch (error) {
      this.#log.warn(error);
      return [];
    }
  }
  #getEdgesFromTarget(name: string) {
    try {
      return this.#graph.inEdges(name);
    } catch (error) {
      this.#log.warn(error);
      return [];
    }
  }

  getTargetListFromSource(name: string) {
    return this.#graph.hasNode(name)
      ? this.#getEdgesFromSource(name).flatMap(
          (name) => this.#graph.getTargetAttributes(name).list,
        )
      : [];
  }
  edgeToNode(item: EdgeItemNewType, type: 'source' | 'target') {
    return {
      name: item[type],
      description: item.description,
      type: '未知',
      chunkId: item.chunkId,
      fileName: item.fileName,
    } as NodeItemNewType;
  }

  createOrUpdateNodeAttr(item: NodeItemNewType) {
    const payload = v.parse(NodeItemNewDefine, item);
    if (this.#graph.hasNode(payload.name)) {
      const obj = this.#graph.getNodeAttributes(payload.name);
      for (let index = 0; index < obj.list.length; index++) {
        const item = obj.list[index];
        if (item.id === payload.id) {
          obj.list[index] = payload;
          this.#graph.replaceNodeAttributes(payload.name, obj);
          return;
        }
      }
      obj.list.push(payload);
      this.#graph.replaceNodeAttributes(payload.name, obj);
    } else {
      this.#graph.addNode(payload.name, {
        list: [payload],
        name: payload.name,
      });
    }
  }
  // source/target可能不存在,需要临时节点
  createOrUpdateEdgeAttr(item: EdgeItemNewType) {
    const payload = v.parse(EdgeItemNewDefine, item);
    if (this.#graph.hasEdge(payload.name)) {
      const obj = this.#graph.getEdgeAttributes(payload.name);
      for (let index = 0; index < obj.list.length; index++) {
        const item = obj.list[index];
        if (item.id === payload.id) {
          obj.list[index] = payload;
          this.#graph.replaceEdgeAttributes(item.name, obj);
          return;
        }
      }
      obj.list.push(payload);
      this.#graph.replaceEdgeAttributes(payload.name, obj);
    } else {
      if (!this.#graph.hasNode(item.source)) {
        this.#graph.addNode(item.source, {
          list: [v.parse(NodeItemNewDefine, this.edgeToNode(item, 'source'))],
          name: item.source,
        });
      }
      if (!this.#graph.hasNode(item.target)) {
        this.#graph.addNode(item.target, {
          list: [v.parse(NodeItemNewDefine, this.edgeToNode(item, 'target'))],
          name: item.target,
        });
      }

      this.#graph.addEdgeWithKey(payload.name, item.source, item.target, {
        list: [payload],
        name: payload.name,
        source: payload.source,
        target: payload.target,
      });
    }
  }
  #deleteNodeAttr(payload: Pick<NodeItemType, 'id' | 'name'>) {
    if (this.#graph.hasNode(payload.name)) {
      const attr = this.#graph.getNodeAttributes(payload.name);
      const index = attr.list.findIndex((item) => item.id === payload.id);
      if (index !== -1) {
        attr.list.splice(index, 1);
        if (attr.list.length === 0) {
          this.#graph.dropNode(payload.name);
        } else {
          this.#graph.replaceNodeAttributes(payload.name, attr);
        }
      }
    }
  }

  #deleteEdgeAttr(item: Pick<EdgeItemType, 'id' | 'source' | 'target'>) {
    const name = getEdgeName(item.source, item.target);
    if (!this.#graph.hasEdge(name)) {
      return;
    }
    const attr = this.#graph.getEdgeAttributes(name);
    for (let index = 0; index < attr.list.length; index++) {
      const edgeItem = attr.list[index];
      if (edgeItem.id === item.id) {
        attr.list.splice(index, 1);
        if (attr.list.length === 0) {
          this.#graph.dropEdge(name);
        } else {
          this.#graph.replaceEdgeAttributes(name, attr);
        }
        return;
      }
    }
  }
  #updateGraph(payload: NodePayload | EdgePayload, update?: boolean) {
    if (payload.kind === 'node') {
      this.createOrUpdateNodeAttr(payload);
    } else if (payload.kind === 'edge') {
      this.createOrUpdateEdgeAttr(payload);
    }
  }
  async loadingData() {
    let offset: string | undefined;
    const [nodeList, edgeList] = await Promise.all(
      ['node', 'edge'].map(async (kind) => {
        const nodePoints = [];
        do {
          const { points, next_page_offset } = await this.#qdClient.scroll(
            this.#config().activateGraphName,
            {
              limit: this.#limit,
              filter: {
                must: {
                  key: 'kind',
                  match: {
                    value: kind,
                  },
                },
              },
              with_payload: true,
              offset: offset,
            },
          );
          nodePoints.push(() => {
            for (const item of points) {
              this.#updateGraph({ ...item.payload!, id: item.id } as any);
            }
          });
          offset = next_page_offset as any;
        } while (offset);
        return nodePoints;
      }),
    );
    nodeList.forEach((fn) => fn());
    edgeList.forEach((fn) => fn());
  }
  /** 一个节点分多个,需要删除原来的节点和边,然后插入
   * 拆分后的节点有可能是存在的
   */
  async splitNode(options: { node: string; list: string[] }) {
    const nodeAttr = this.#graph.getNodeAttributes(options.node);
    options.list.map((replaceNodeName) => {
      nodeAttr.list.forEach((item) => {
        this.createOrUpdateNodeAttr({ ...item, name: replaceNodeName });
      });
    });
    const sourceEdges = this.#getEdgesFromSource(options.node);
    const targetEdges = this.#getEdgesFromTarget(options.node);
    for (const edge of sourceEdges) {
      const attr = this.#graph.getEdgeAttributes(edge);
      for (const replaceNodeName of options.list) {
        attr.list.forEach((attrItem) => {
          this.createOrUpdateEdgeAttr({ ...attrItem, source: replaceNodeName });
        });
      }
    }
    for (const edge of targetEdges) {
      const attr = this.#graph.getEdgeAttributes(edge);
      for (const replaceNodeName of options.list) {
        attr.list.forEach((attrItem) => {
          this.createOrUpdateEdgeAttr({ ...attrItem, target: replaceNodeName });
        });
      }
    }

    this.#graph.dropNode(options.node);
    this.update$.update((a) => a + 1);
  }
  async mergeNode(options: { node: string; list: string[] }) {
    const sourceEdges = options.list.flatMap((item) =>
      this.#getEdgesFromSource(item),
    );
    const targetEdges = options.list.flatMap((item) =>
      this.#getEdgesFromTarget(item),
    );
    // 先插入节点,防止边创建
    options.list.forEach((node) => {
      const attr = this.#graph.getNodeAttributes(node);
      attr.list.forEach((item) => {
        this.createOrUpdateNodeAttr({ ...item, name: options.node });
      });
    });
    for (const edge of sourceEdges) {
      const data = this.#graph.getEdgeAttributes(edge);
      data.list.forEach((item) => {
        this.createOrUpdateEdgeAttr({ ...item, source: options.node });
      });
    }
    for (const edge of targetEdges) {
      const data = this.#graph.getEdgeAttributes(edge);
      data.list.forEach((item) => {
        this.createOrUpdateEdgeAttr({ ...item, target: options.node });
      });
    }

    options.list.forEach((item) => {
      this.#graph.dropNode(item);
    });
    this.update$.update((a) => a + 1);
  }

  async changeNodeDescription(payload: NodeItemType) {
    this.createOrUpdateNodeAttr(payload);
    this.update$.update((a) => a + 1);
  }

  async changeEdge(
    item: EdgeItemType,
    oldItem: Pick<EdgePayload, 'id' | 'source' | 'target'>,
  ) {
    this.createOrUpdateEdgeAttr(item);
    if (item.source !== oldItem.source || item.target !== oldItem.target) {
      this.#deleteEdgeAttr(oldItem);
    }
    this.update$.update((a) => a + 1);
  }
  async add(input: KnowledgeGraphItemType) {
    // 可能添加部分
    input.nodes?.forEach((item) => {
      this.createOrUpdateNodeAttr(item);
    });
    input.edges?.forEach((item) => {
      this.createOrUpdateEdgeAttr(item);
    });
    this.update$.update((a) => a + 1);
  }
  async deleteNodeItem(item: Pick<NodeItemType, 'id' | 'name'>) {
    this.#deleteNodeAttr(item);
    this.update$.update((a) => a + 1);
  }
  deleteEdgeItem(item: Pick<EdgeItemType, 'id' | 'source' | 'target'>) {
    this.#deleteEdgeAttr(item);
    this.update$.update((a) => a + 1);
  }
  deleteNode(name: string) {
    this.#graph.dropNode(name);
    this.update$.update((a) => a + 1);
  }
  /**
   * node=>edge
   * 确定最相似的chunk(第一位)
   * 获取传入节点的所有变
   */
  getEdgeByNode(nodes: NodePayload[]) {
    const repeatList = new Set();
    const list = [];
    for (const node of nodes) {
      for (const edgeName of [
        ...this.#graph.outEdges(node.name),
        ...this.#graph.inEdges(node.name),
      ]) {
        const key = `${edgeName}|${node.chunkId}`;
        if (repeatList.has(key)) {
          continue;
        }
        repeatList.add(key);
        list.push(
          ...this.#graph
            .getEdgeAttributes(edgeName)
            .list.filter((item) => item.chunkId === node.chunkId),
        );
      }
    }
    return list;
  }

  /**
   * 根据边查节点
   * 通过边上的chunkid,查找同在这个chunkid上的souce/target节点,权重为边
   */
  getNodeByEdge(edges: EdgePayload[]) {
    const repeatList = new Set();
    const list = [];
    for (const edge of edges) {
      for (const nodeName of [edge.source, edge.target]) {
        const key = `${nodeName}|${edge.chunkId}`;
        if (repeatList.has(key)) {
          continue;
        }
        repeatList.add(key);
        list.push(
          ...this.#graph
            .getNodeAttributes(nodeName)
            .list.filter((item) => item.chunkId === edge.chunkId),
        );
      }
    }
    return list;
  }
  getChunkEdgeByNode(node: Pick<NodeItemType, 'name' | 'chunkId'>) {
    const list = [];
    for (const edgeName of [
      ...this.#graph.outEdges(node.name),
      ...this.#graph.inEdges(node.name),
    ]) {
      const edgeAttr = this.#graph.getEdgeAttributes(edgeName);
      list.push(
        ...edgeAttr.list.filter((item) => node.chunkId === item.chunkId),
      );
    }
    return list;
  }
}
