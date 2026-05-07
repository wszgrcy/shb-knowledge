import { equal, ok } from 'assert';
import { Injector, INJECTOR_SCOPE } from 'static-injector';
import { GraphLocalService } from '../graph/graph.local.service';
import { ConfigToken } from '../const';
import { expect } from 'chai';
import { EdgeItemNewType, NodeItemNewType } from '../graph/define/define';
import { getEdgeName } from '../graph/util';
import { LogToken, withResolvers } from '@shenghuabi/knowledge/util';
import { QdrantStartToken } from '@shenghuabi/knowledge/qdrant';

describe('图变更服务', () => {
  let injector;
  let instance: GraphLocalService;
  beforeEach(() => {
    const qdStart = withResolvers();

    injector = Injector.create({
      providers: [
        { provide: INJECTOR_SCOPE, useValue: 'root' },
        GraphLocalService,
        { provide: ConfigToken, useValue: { name: '' } },
        { provide: QdrantStartToken, useValue: qdStart },
        {
          provide: LogToken,
          useValue: {
            warn: () => {},
            error: () => {},
            info: () => {},
          },
        },
      ],
    });
    instance = injector.get(GraphLocalService);
  });
  it('基础', () => {
    const graph = instance.initGraph();
    const node: NodeItemNewType = {
      name: 'aa',
      description: 'bb',
      chunkId: '',
      fileName: '',
      type: '',
    };
    instance.createOrUpdateNodeAttr(node);
    ok(graph.hasNode('aa'));
    const list = graph.getNodeAttributes('aa').list;
    equal(list.length, 1);
    expect(list[0]).include(node);
  });
  it('添加节点', () => {
    const graph = instance.initGraph();
    const node: NodeItemNewType = {
      name: 'aa',
      description: 'bb',
      chunkId: '',
      fileName: '',
      type: '',
    };
    // 添加时不存在
    instance.createOrUpdateNodeAttr(node);
    ok(graph.hasNode('aa'));
    let list = graph.getNodeAttributes('aa').list;
    equal(list.length, 1);
    expect(list[0]).include(node);
    const node2: NodeItemNewType = {
      name: 'aa',
      description: 'descript2',
      chunkId: '',
      fileName: '',
      type: '',
    };
    // 添加时已经存在
    instance.createOrUpdateNodeAttr(node2);
    list = graph.getNodeAttributes('aa').list;
    equal(list.length, 2);
    expect(list[1]).include(node2);
    // 修改已有
    instance.createOrUpdateNodeAttr({
      ...list[1],
      description: 'description3',
    });
    list = graph.getNodeAttributes('aa').list;
    expect(list[1].description).eq('description3');
  });
  it('添加边', () => {
    const graph = instance.initGraph();
    const edge: EdgeItemNewType = {
      description: 'bb',
      chunkId: '',
      fileName: '',
      source: 'aaa',
      target: 'bbb',
      keywords: [],
    };
    // 添加时不存在,顺便创建节点
    instance.createOrUpdateEdgeAttr(edge);
    ok(graph.hasNode('aaa'));
    ok(graph.hasNode('bbb'));
    const nodeList = graph.getNodeAttributes('aaa').list;
    equal(nodeList.length, 1);
    expect(nodeList[0]).include({ name: 'aaa', description: 'bb' });
    const edgeName = getEdgeName(edge.source, edge.target);
    const edgeList = graph.getEdgeAttributes(edgeName);
    equal(edgeList.list.length, 1);

    expect(edgeList.list[0]).deep.include(edge);

    const edge2: EdgeItemNewType = {
      description: 'descript2',
      chunkId: '',
      fileName: '',
      source: 'aaa',
      target: 'bbb',
      keywords: [],
    };
    // 创建时边已存在
    instance.createOrUpdateEdgeAttr(edge2);
    let attr = graph.getEdgeAttributes(edgeName);

    equal(attr.list.length, 2);
    expect(attr.list[1]).deep.include(edge2);

    // 替换存在边
    instance.createOrUpdateEdgeAttr({ ...attr.list[1], description: '666' });
    attr = graph.getEdgeAttributes(edgeName);
    equal(attr.list.length, 2);
    expect(attr.list[1]).deep.include({ description: '666' });
  });

  it('节点拆分', () => {
    const graph = instance.initGraph();
    const node: NodeItemNewType = {
      name: 'aa',
      description: 'bb',
      chunkId: '',
      fileName: '',
      type: '',
    };
    // 添加时不存在
    instance.createOrUpdateNodeAttr(node);
    instance.createOrUpdateEdgeAttr({
      source: 'aa',
      target: 'at',
      keywords: [],
      chunkId: '',
      fileName: '',
    });
    instance.createOrUpdateEdgeAttr({
      source: 'as',
      target: 'aa',
      keywords: [],
      chunkId: '',
      fileName: '',
    });

    instance.splitNode({ node: node.name, list: ['bb', 'cc'] });
    ok(!graph.hasNode('aa'));
    ok(graph.hasNode('bb'));
    ok(graph.hasNode('cc'));
    ok(graph.hasEdge(getEdgeName('bb', 'at')));
    ok(graph.hasEdge(getEdgeName('cc', 'at')));
    ok(graph.hasEdge(getEdgeName('as', 'bb')));
    ok(graph.hasEdge(getEdgeName('as', 'cc')));
    let attr = graph.getNodeAttributes('bb');
    equal(attr.list.length, 1);
    expect(attr.list[0]).deep.include({ ...node, name: 'bb' });
    attr = graph.getNodeAttributes('cc');
    equal(attr.list.length, 1);
    expect(attr.list[0]).deep.include({ ...node, name: 'cc' });
  });
  it('节点合并', () => {
    const graph = instance.initGraph();
    const node: NodeItemNewType = {
      name: 'aa',
      description: 'n1',
      chunkId: '',
      fileName: '',
      type: '',
    };
    const node2: NodeItemNewType = {
      name: 'bb',
      description: 'n2',
      chunkId: '',
      fileName: '',
      type: '',
    };
    // 添加时不存在
    instance.createOrUpdateNodeAttr(node);
    instance.createOrUpdateNodeAttr(node2);
    instance.createOrUpdateEdgeAttr({
      source: 'bb',
      target: 'bt',
      fileName: '',
      chunkId: '',
      keywords: [],
    });
    instance.createOrUpdateEdgeAttr({
      source: 'bs',
      target: 'bb',
      fileName: '',
      chunkId: '',
      keywords: [],
    });

    instance.mergeNode({ node: 'cc', list: ['aa', 'bb'] });
    ok(!graph.hasNode('aa'));
    ok(!graph.hasNode('bb'));
    ok(graph.hasNode('cc'));
    ok(graph.hasEdge(getEdgeName('cc', 'bt')));
    ok(graph.hasEdge(getEdgeName('bs', 'cc')));
    const attr = graph.getNodeAttributes('cc');
    equal(attr.list.length, 2);
    ok(attr.list.some((item) => item.description === 'n1'));
    ok(attr.list.some((item) => item.description === 'n2'));
  });
  it('描述修改', () => {
    const graph = instance.initGraph();
    const node: NodeItemNewType = {
      name: 'aa',
      description: 'n1',
      chunkId: '',
      fileName: '',
      type: '',
    };

    // 添加时不存在
    instance.createOrUpdateNodeAttr(node);
    let attr = graph.getNodeAttributes('aa');
    instance.changeNodeDescription({ ...attr.list[0], description: 'n2' });
    attr = graph.getNodeAttributes('aa');
    equal(attr.list.length, 1);
    equal(attr.list[0].description, 'n2');
  });
  it(`边修改('描述')`, () => {
    const graph = instance.initGraph();
    const edge: EdgeItemNewType = {
      description: 'bb',
      chunkId: '',
      fileName: '',
      source: 'aaa',
      target: 'bbb',
      keywords: [],
    };

    // 添加时不存在
    instance.createOrUpdateEdgeAttr(edge);
    expect(graph.edges().length).eq(1);
    let attr = graph.getEdgeAttributes(getEdgeName(edge.source, edge.target));
    instance.changeEdge({ ...attr.list[0], description: 'n2' }, attr.list[0]);
    expect(graph.edges().length).eq(1);
    attr = graph.getEdgeAttributes(getEdgeName(edge.source, edge.target));
    equal(attr.list.length, 1);
    equal(attr.list[0].description, 'n2');
  });
  it(`边修改('关系')`, () => {
    const graph = instance.initGraph();
    const edge: EdgeItemNewType = {
      description: 'bb',
      chunkId: '',
      fileName: '',
      source: 'aaa',
      target: 'bbb',
      keywords: [],
      id: 'aa',
    };

    // 添加时不存在
    instance.createOrUpdateEdgeAttr(edge);
    expect(graph.edges().length).eq(1);
    let attr = graph.getEdgeAttributes(getEdgeName(edge.source, edge.target));
    instance.changeEdge({ ...attr.list[0], target: '222' }, attr.list[0]);
    expect(graph.edges().length).eq(1);
    attr = graph.getEdgeAttributes(getEdgeName(edge.source, '222'));
    equal(attr.list.length, 1);
    equal(attr.list[0].target, '222');
  });
  it('添加节点和边', () => {
    const graph = instance.initGraph();
    const node: NodeItemNewType = {
      name: 'aa',
      description: 'n1',
      chunkId: '',
      fileName: '',
      type: '',
    };

    const edge: EdgeItemNewType = {
      description: 'bb',
      chunkId: '',
      fileName: '',
      source: 'aa',
      target: 'bb',
      keywords: [],
    };
    const data = instance.graphExport$$();

    equal(data.nodes.length, 0);
    // 添加时不存在
    instance.add({ nodes: [node], edges: [edge] });

    const nodeAttr = graph.getNodeAttributes(node.name);
    equal(nodeAttr.list.length, 1);
    expect(nodeAttr.list[0]).deep.include(node);
    const edgeAttr = graph.getEdgeAttributes(
      getEdgeName(edge.source, edge.target),
    );
    equal(edgeAttr.list.length, 1);
    expect(edgeAttr.list[0]).deep.include(edge);
    const data2 = instance.graphExport$$();
    equal(data2.nodes.length, 2);
    ok(data !== data2);
  });
  it('删除节点某一项', () => {
    const graph = instance.initGraph();
    const node: NodeItemNewType = {
      name: 'aa',
      description: 'n1',
      chunkId: '',
      fileName: '',
      type: '',
    };
    const node2: NodeItemNewType = {
      name: 'aa',
      description: 'n2',
      chunkId: '',
      fileName: '',
      type: '',
    };

    instance.createOrUpdateNodeAttr(node);
    instance.createOrUpdateNodeAttr(node2);
    let nodeAttr = graph.getNodeAttributes(node.name);

    equal(nodeAttr.list.length, 2);
    instance.deleteNodeItem({ id: nodeAttr.list[0].id, name: node.name });
    nodeAttr = graph.getNodeAttributes(node.name);
    equal(nodeAttr.list.length, 1);
    instance.deleteNodeItem({ id: nodeAttr.list[0].id, name: node.name });
    ok(!graph.hasNode(node.name));
  });

  it('删除边', () => {
    const graph = instance.initGraph();

    const edge: EdgeItemNewType = {
      description: 'n1',
      chunkId: '',
      fileName: '',
      source: 'aa',
      target: 'bb',
      keywords: [],
    };
    const edge2: EdgeItemNewType = {
      description: 'n2',
      chunkId: '',
      fileName: '',
      source: 'aa',
      target: 'bb',
      keywords: [],
    };
    const edgeName = getEdgeName(edge.source, edge.target);
    // 添加时不存在
    instance.add({ edges: [edge, edge2] });
    let edgeAttr = graph.getEdgeAttributes(edgeName);
    equal(edgeAttr.list.length, 2);
    instance.deleteEdgeItem({
      id: edgeAttr.list[0].id,
      source: edge.source,
      target: edge.target,
    });
    edgeAttr = graph.getEdgeAttributes(edgeName);
    equal(edgeAttr.list.length, 1);
    instance.deleteEdgeItem({
      id: edgeAttr.list[0].id,
      source: edge.source,
      target: edge.target,
    });
    ok(!graph.hasEdge(edgeName));
  });
  // 拆分/合并节点的时候加上边,防止边先创建

  it('添加整个边', () => {
    const graph = instance.initGraph();
    const node: NodeItemNewType = {
      name: 'aa',
      description: 'bb',
      chunkId: '',
      fileName: '',
      type: '',
    };
    const node2: NodeItemNewType = {
      name: 'aa',
      description: 'bb',
      chunkId: '',
      fileName: '',
      type: '',
    };
    // 添加时不存在
    instance.add({
      nodes: [node, node2],
    });
    instance.deleteNode(node.name);

    ok(!graph.hasNode(node.name));
  });
});
