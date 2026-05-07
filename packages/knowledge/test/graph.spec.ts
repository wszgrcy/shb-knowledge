import { deepStrictEqual, equal, ok } from 'assert';
import Graph from 'graphology';
import { differenceBy } from 'lodash-es';

describe('图处理', () => {
  it('添加边', () => {
    // 添加边之前必须有对应的节点
    const graph = new Graph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b');
    equal(graph.nodes().length, 2);
    equal(graph.edges().length, 1);
  });
  it('直接删除边', () => {
    // 通过source target确定边
    const graph = new Graph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b');
    graph.dropEdge('a', 'b');
    equal(graph.nodes().length, 2);
    equal(graph.edges().length, 0);
  });
  it('通过名字删除边', () => {
    // 通过source target确定边
    const graph = new Graph();
    graph.addNode('a');
    graph.addNode('b');
    const edge = graph.addEdge('a', 'b');
    graph.dropEdge(edge);
    equal(graph.nodes().length, 2);
    equal(graph.edges().length, 0);
  });
  it('有边时删除节点', () => {
    // 节点没了,连接节点的边也没了
    const graph = new Graph();
    graph.addNode('a');
    graph.addNode('b');
    graph.addEdge('a', 'b');
    graph.dropNode('a');
    equal(graph.nodes().length, 1);
    equal(graph.edges().length, 0);
  });
  it('根据节点查边', () => {
    const graph = new Graph();
    graph.addNode('a');
    graph.addNode('b');
    const edgeName = graph.addEdge('a', 'b');
    // 根据target查边
    let list = graph.inEdges('b');
    equal(edgeName, list[0]);
    // 根据source查边
    list = graph.outEdges('a');
    equal(edgeName, list[0]);
  });
  it('边命名', () => {
    const graph = new Graph();
    graph.addNode('a');
    graph.addNode('b');
    const edgeName = 'a,b';
    graph.addEdgeWithKey(edgeName, 'a', 'b');
    // 根据target查边
    let list = graph.inEdges('b');
    equal(edgeName, list[0]);
    // 根据source查边
    list = graph.outEdges('a');
    equal(edgeName, list[0]);
  });
  it('获取node数据', () => {
    const graph = new Graph();
    const data = { test: 1 };
    graph.addNode('a', data);
    const attr = graph.getNodeAttributes('a');
    equal(attr, data);
  });
  it('获取edge数据', () => {
    const graph = new Graph();
    graph.addNode('a');
    graph.addNode('b');
    const edgeName = 'a,b';
    const data = { test: 1 };
    graph.addEdgeWithKey(edgeName, 'a', 'b', data);
    const list = graph.inEdges('b');
    const attr = graph.getEdgeAttributes(edgeName);
    equal(attr, data);
  });
  it('获取不存在节点', () => {
    const graph = new Graph();
    graph.addNode('a');
    try {
      const attr = graph.getNodeAttributes('b');
    } catch (error) {
      ok(error);
      return;
    }
    throw new Error('不可能执行');
  });
  it('获取edge数据', () => {
    const graph = new Graph();
    graph.addNode('a');
    graph.addNode('b');
    const edgeName = 'a,b';
    const data = { test: 1 };
    graph.addEdgeWithKey(edgeName, 'a', 'b', data);
    const a = graph.getEdgeAttributes(edgeName);
    ok(a);
  });
});
describe('工具', () => {
  it('diff', () => {
    const a = [1, 2];
    const b = [2, 3];
    const result = differenceBy(a, b);
    // [1]
    deepStrictEqual(result, [1]);
  });
});
