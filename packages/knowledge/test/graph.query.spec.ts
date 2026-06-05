import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { Injector } from 'static-injector';
import { ServerReturn, startServer } from '../../qdrant/test/util/start-server';
import { getActivateCollectionName, getGraphCollectionName } from '../const';
import { createManager, TestManager } from './util/create-manager';
import * as fs from 'fs/promises';
import { GraphCollectionInlineType } from '../graph/define/config';
import { transformersText2Vec } from './util/transformers-test-text2vec';
import { expect } from 'chai';
import { ok } from 'assert';
import { getEdgeName } from '../graph/util';
import * as v from 'valibot';
import { GraphRelationQueryDefine } from '../graph/define/query';
import { eq } from 'lodash-es';
import path from 'path';

describe('图查询', () => {
  let instance!: TestManager;
  let server: ServerReturn;
  let injector!: Injector;
  let tempDir: string;
  beforeEach(async () => {});
  afterEach(async () => {
    if (tempDir) {
      await server.dispose();
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
  it.skip('下载', async () => {
    const a = await transformersText2Vec('', '384');
    const b = await transformersText2Vec('', '312');
    // console.log('长度', a[0].length, b[0].length);
  });
  it('基础', async () => {
    const { service, dir, create, qdStart } = await createManager({
      text2Vec: transformersText2Vec,
    });
    tempDir = dir;
    injector = create();
    instance = injector.get(service);
    server = await startServer();
    const qd = injector.get(QdrantClientService);
    qdStart.resolve();
    // 每次调用手动初始化

    const name = '312';
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });

    await instance.create(name, {
      collectionName: name,
      size: 312,
    });
    const collection2 = {
      collectionName: '384',
      size: 512,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);

    const graph = await instance.getGraph(name);
    await graph.knowledge.insertItem('doc', 'content');
    await graph.knowledge.insertItem('标题', '内容');
    const { points: chunkList } = await qd.scroll(
      getActivateCollectionName(name),
    );
    expect(chunkList.length).eq(2);
    const engPoint = chunkList.find(
      (item) => item.payload!['fileName'] === 'doc',
    )! as any;
    ok(engPoint);
    const cnPoint = chunkList.find(
      (item) => item.payload!['fileName'] === '标题',
    )! as any;
    ok(cnPoint);
    await graph.loadDataInit$$();
    await graph.add({
      nodes: [
        {
          name: 'node1',
          type: 't1',
          chunkId: engPoint.id,
          fileName: 'doc',
        },
        {
          name: 'node2',
          type: 't1',
          chunkId: engPoint.id,
          fileName: 'doc',
        },
      ],
      edges: [
        {
          source: 'node1',
          target: 'node2',
          chunkId: engPoint.id,
          fileName: 'doc',
          keywords: [],
        },
        {
          source: 'n1',
          target: 'n3',
          chunkId: engPoint.id,
          fileName: 'doc',
          keywords: [],
        },
      ],
    });
    const queryInstance = graph.createQuery({
      topK: 999,
      lengthLimit: {
        chunk: 999,
        node: 999,
        nodeDescription: 999,
        edge: 999,
      },
    });
    const result = await queryInstance.query(
      { node: 'node1', edge: 'node1' },
      '',
    );
    expect(result.nodes[0].name).eq('node1');
    let result2 = await queryInstance.searchNode('node2', []);
    expect(result2).deep.eq(['node2']);
    result2 = await queryInstance.searchNode('node2', ['node2']);
    expect(result2).deep.eq([]);
    const result3 = await queryInstance.getFileNameList();
    expect(result3.length).eq(2);
    const result4 = await queryInstance.getChunkContent('doc');
    expect(result4.length).eq(1);
    const result5 = await queryInstance.getGraphData();
    // 两个定义,两个边自定义
    expect(result5.nodes.length).eq(6);
    expect(result5.edges.length).eq(3);
  });
  it('插入异常删除', async () => {
    const { service, dir, create, qdStart } = await createManager({
      text2Vec: transformersText2Vec,
    });
    tempDir = dir;
    injector = create();
    instance = injector.get(service);
    server = await startServer();
    const qd = injector.get(QdrantClientService);
    qdStart.resolve();
    // 每次调用手动初始化

    const name = '312';
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });

    await instance.create(name, {
      collectionName: name,
      size: 312,
    });
    const collection2 = {
      collectionName: '384',
      size: 512,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);

    const graph = await instance.getGraph(name);
    await graph.knowledge.insertItem('docx', 'content');
    const { points } = await (await qd.originClient).scroll(name);
    expect(points.length).eq(0);
    const { points: p2 } = await (
      await qd.originClient
    ).scroll(getGraphCollectionName(name));
    expect(p2.length).eq(0);
    const result = await fs.readdir(path.join(tempDir, name));
    expect(result.length).eq(0);
  });
  it('全局', async () => {
    const { service, dir, create, qdStart } = await createManager({
      text2Vec: transformersText2Vec,
    });
    tempDir = dir;
    injector = create();
    instance = injector.get(service);
    server = await startServer();
    const qd = injector.get(QdrantClientService);
    qdStart.resolve();
    // 每次调用手动初始化

    const name = '312';
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });

    await instance.create(name, {
      collectionName: name,
      size: 312,
    });
    const collection2 = {
      collectionName: '384',
      size: 512,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);

    const graph = await instance.getGraph(name);
    const queryInstance = graph.createQuery({
      topK: 999,
      lengthLimit: {
        chunk: 999,
        node: 999,
        nodeDescription: 999,
        edge: 999,
      },
    });
    await graph.knowledge.insertItem('doc', 'content');
    await graph.knowledge.insertItem('标题', '内容');
    const { points: chunkList } = await qd.scroll(
      getActivateCollectionName(name),
    );
    expect(chunkList.length).eq(2);
    const engPoint = chunkList.find(
      (item) => item.payload!['fileName'] === 'doc',
    )! as any;
    const cnPoint = chunkList.find(
      (item) => item.payload!['fileName'] === '标题',
    )! as any;
    await graph.loadDataInit$$();
    await graph.add({
      nodes: [
        {
          name: 'node1',
          type: 't1',
          chunkId: engPoint.id,
          fileName: 'doc',
        },
        {
          name: 'node2',
          type: 't1',
          chunkId: engPoint.id,
          fileName: 'doc',
        },
      ],
      edges: [
        {
          source: 'node1',
          target: 'node2',
          chunkId: engPoint.id,
          fileName: 'doc',
          keywords: [],
          description: 'test-description',
        },
        {
          source: 'node1',
          target: 'n3',
          chunkId: engPoint.id,
          fileName: 'doc',
          keywords: [],
        },
      ],
    });

    const result = await queryInstance.query(
      {
        node: 'node1,node2,test-description',
        edge: 'node1,node2,test-description',
      },
      '',
    );
    expect(result.edges[0].name).eq('node1,node2');
  });
  it('混合', async () => {
    const { service, dir, create, qdStart } = await createManager({
      text2Vec: transformersText2Vec,
    });
    tempDir = dir;
    injector = create();
    instance = injector.get(service);
    server = await startServer();
    const qd = injector.get(QdrantClientService);
    qdStart.resolve();
    // 每次调用手动初始化

    const name = '312';
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });

    await instance.create(name, {
      collectionName: name,
      size: 312,
    });
    const collection2 = {
      collectionName: '384',
      size: 512,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);

    const graph = await instance.getGraph(name);
    const queryInstance = graph.createQuery({
      topK: 999,
      lengthLimit: {
        chunk: 999,
        node: 999,
        nodeDescription: 999,
        edge: 40,
      },
    });
    await graph.knowledge.insertItem('doc', 'content');
    await graph.knowledge.insertItem('标题', '内容');
    const { points: chunkList } = await qd.scroll(
      getActivateCollectionName(name),
    );
    expect(chunkList.length).eq(2);
    const engPoint = chunkList.find(
      (item) => item.payload!['fileName'] === 'doc',
    )! as any;
    const cnPoint = chunkList.find(
      (item) => item.payload!['fileName'] === '标题',
    )! as any;
    await graph.loadDataInit$$();
    await graph.add({
      nodes: [
        {
          name: 'node1',
          type: 't1',
          chunkId: engPoint.id,
          fileName: 'doc',
          description: 'node1-description',
        },
        {
          name: 'node2',
          type: 't1',
          chunkId: engPoint.id,
          fileName: 'doc',
        },
      ],
      edges: [
        {
          source: 'node1',
          target: 'node2',
          chunkId: engPoint.id,
          fileName: 'doc',
          keywords: [],
          description: 'test-description',
        },
        {
          source: 'node1',
          target: 'n3',
          chunkId: engPoint.id,
          fileName: 'doc',
          keywords: [],
        },
      ],
    });

    const result = await queryInstance.query(
      {
        node: 'node1,node1-description',
        edge: 'node1,node2,test-description',
      },
      '',
    );
    expect(result.edges[0].name).eq('node1,node2');
    expect(result.nodes[0].name).eq('node1');
  });
  it('从请求中初始化图', async () => {
    const { service, dir, create, qdStart } = await createManager({
      text2Vec: transformersText2Vec,
    });
    tempDir = dir;
    injector = create();
    instance = injector.get(service);
    server = await startServer();
    const qd = injector.get(QdrantClientService);
    qdStart.resolve();
    // 每次调用手动初始化

    const name = '312';
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });

    await instance.create(name, {
      collectionName: name,
      size: 312,
    });
    const collection2 = {
      collectionName: '384',
      size: 512,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);

    const graph = await instance.getGraph(name);

    await graph.knowledge.insertItem('doc', 'content');
    await graph.loadDataInit$$();
    const g = graph.getGraph();
    ok(g.hasNode('s1'));
    ok(g.hasNode('d1'));
    ok(g.hasEdge(getEdgeName('s1', 'd1')));
  });
  it.skip('测试查询条件', () => {
    let result = v.parse(GraphRelationQueryDefine, { node: '' });
    eq(result.node, '');
    result = v.parse(GraphRelationQueryDefine, { edge: '' });
    eq(result.edge, '');
    result = v.parse(GraphRelationQueryDefine, { edge: '1', node: '1' });
    eq(result.node, '1');
    eq(result.edge, '1');

    {
      const result = v.safeParse(GraphRelationQueryDefine, {});
      ok(!result.success);
      eq(result.issues[0].type, 'partial_check');
    }
  });
});
