import { path } from '@cyia/vfs2';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { Injector } from 'static-injector';
import { ServerReturn, startServer } from '../../qdrant/test/util/start-server';
import { getGraphCollectionName } from '../const';
import { createManager, TestManager } from './util/create-manager';
import * as fs from 'fs/promises';
import { equal, ok } from 'assert';
import { getFixtureDir } from './util/get-fixture';
import { GraphCollectionInlineType } from '../graph/define/config';
import { expect } from 'chai';
import * as v from 'valibot';
import { EdgePayloadDefine } from '../graph/define';

describe('图处理', () => {
  let instance!: TestManager;
  let server: ServerReturn;
  let injector!: Injector;
  let tempDir: string;
  beforeEach(async () => {
    const { service, dir, create, qdStart } = await createManager();
    tempDir = dir;
    injector = create();
    instance = injector.get(service);
    server = await startServer();
    const qd = injector.get(QdrantClientService);
    qdStart.resolve();
  });
  afterEach(async () => {
    await server.dispose();
    await fs.rm(tempDir, { recursive: true, force: true });
  });
  it('基础', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const collection2 = {
      collectionName: 'collection2',
      size: 200,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);
    const handle = await instance.getGraph(name);
    handle.initGraph();
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const qd = injector.get(QdrantClientService);
    const chunkResult = await qd.scroll(name);
    const chunkId = chunkResult.points[0].id as string;
    const fileName = chunkResult.points[0].payload!['fileName'] as any;
    expect(handle.getGraph().nodes().length).greaterThan(0);
    expect(handle.getGraph().edges().length).greaterThan(0);
    // 添加节点
    await handle.add({
      nodes: [
        { chunkId, fileName, name: 'sn1', description: 'd1', type: 't1' },
      ],
    });
    let { points } = await qd.scroll(getGraphCollectionName(name));
    const point = points.find(
      (item) => item.payload!['name'] === 'sn1',
    )?.payload!;
    ok(point);
    equal(point!['description']!, 'd1');
    equal(point!['kind']!, 'node');
    // 节点拆分
    await handle.splitNode({ node: 'sn1', list: ['sn2', 'sn3', 'sn4'] });
    ({ points } = await qd.scroll(getGraphCollectionName(name)));
    let list = points.filter(
      (item) =>
        item.payload!['kind'] === 'node' &&
        (item.payload!['name'] as string).startsWith('sn'),
    );
    equal(list.length, 3);
    equal(
      list.every((item) => item.payload!['name'] === 'n1'),
      false,
    );
    await handle.add({
      nodes: [
        {
          chunkId,
          fileName,
          name: 'current1',
          description: '描述1',
          type: 't1',
        },
        {
          chunkId,
          fileName,
          name: 'toMerge1',
          description: '描述2',
          type: 't1',
        },
      ],
      edges: [
        {
          source: 'toMerge1',
          target: 'sn1',
          description: '',
          chunkId,
          fileName,
        },
      ],
    });
    // 节点合并
    await handle.mergeNode({ node: 'current1', list: ['toMerge1'] });
    ({ points } = await qd.scroll(getGraphCollectionName(name)));
    list = points.filter(
      (item) =>
        item.payload!['kind'] === 'node' &&
        (item.payload!['name'] as string) === 'current1',
    );
    equal(list.length, 2);
    expect(list[0].payload!['description']);
    ok(list.every((item) => item.payload!['name'] === 'current1'));
    ok(list.some((item) => item.payload!['description'] === '描述2'));
    const edgeList = points.filter(
      (item) =>
        item.payload!['kind'] === 'edge' &&
        (item.payload!['source'] as string) === 'current1',
    );
    equal(edgeList.length, 1);
    expect(edgeList[0].payload!['source']).eq('current1');
    expect(edgeList[0].payload!['target']).eq('sn1');
  });
  it('节点描述修改(也可以修改其他的)', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const collection2 = {
      collectionName: 'collection2',
      size: 200,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const qd = injector.get(QdrantClientService);
    const chunkResult = await qd.scroll(name);
    const chunkId = chunkResult.points[0].id as string;
    const fileName = chunkResult.points[0].payload!['fileName'] as any;
    const handle = await instance.getGraph(name);
    handle.initGraph();

    // 添加节点
    await handle.add({
      nodes: [
        { chunkId, fileName, name: 'sn1', description: 'd1', type: 't1' },
      ],
    });
    let { points } = await qd.scroll(getGraphCollectionName(name));
    let point = points.find((item) => item.payload!['name'] === 'sn1')!;
    // 修改节点项
    await handle.changeNodeDescription({
      ...point.payload,
      description: 'change1',
      id: point.id,
    } as any);
    ({ points } = await qd.scroll(getGraphCollectionName(name)));
    point = points.find((item) => item.payload!['name'] === 'sn1')!;
    equal(point.payload!['description']!, 'change1');
  });
  it('删除某一条', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const collection2 = {
      collectionName: 'collection2',
      size: 200,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const qd = injector.get(QdrantClientService);
    const chunkResult = await qd.scroll(name);
    const chunkId = chunkResult.points[0].id as string;
    const fileName = chunkResult.points[0].payload!['fileName'] as any;
    const handle = await instance.getGraph(name);
    handle.initGraph();

    // 添加节点
    await handle.add({
      nodes: [
        { chunkId, fileName, name: 'sn1', description: 'd1', type: 't1' },
      ],
      edges: [
        {
          chunkId,
          fileName,
          source: 'sn1',
          description: '',
          strength: 0,
          keywords: [],
          target: 'xx',
        },
      ],
    });
    let { points } = await qd.scroll(getGraphCollectionName(name));
    const point = points.find((item) => item.payload!['name'] === 'sn1')!;
    // 修改节点项
    ok(point);
    await handle.deleteNodeItem({
      id: point.id as any,
      name: point.payload!['name'] as any,
    });
    ({ points } = await qd.scroll(getGraphCollectionName(name)));
    equal(
      points.filter(
        (item) =>
          item.payload!['kind'] === 'edge' && item.payload!['source'] === 'sn1',
      ).length,
      0,
    );
    equal(points.filter((item) => item.payload!['name'] === 'sn1').length, 0);
  });
  it('删除某一条边', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const collection2 = {
      collectionName: 'collection2',
      size: 200,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const qd = injector.get(QdrantClientService);
    const chunkResult = await qd.scroll(name);
    const chunkId = chunkResult.points[0].id as string;
    const fileName = chunkResult.points[0].payload!['fileName'] as any;
    const handle = await instance.getGraph(name);
    handle.initGraph();

    // 添加节点
    await handle.add({
      nodes: [],
      edges: [
        {
          chunkId,
          fileName,
          source: 'sn1',
          description: '',
          strength: 0,
          keywords: [],
          target: 'xx',
        },
      ],
    });
    let { points } = await qd.scroll(getGraphCollectionName(name));
    const point = points.find((item) => item.payload!['source'] === 'sn1')!;
    // 修改节点项
    ok(point);
    await handle.deleteEdge({
      id: point.id as any,
      source: 'sn1',
      target: 'xx',
    });
    ({ points } = await qd.scroll(getGraphCollectionName(name)));
    equal(
      points.filter(
        (item) =>
          item.payload!['kind'] === 'edge' && item.payload!['source'] === 'sn1',
      ).length,
      0,
    );
  });
  it('删除整个节点', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const collection2 = {
      collectionName: 'collection2',
      size: 200,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const qd = injector.get(QdrantClientService);
    const chunkResult = await qd.scroll(name);
    const chunkId = chunkResult.points[0].id as string;
    const fileName = chunkResult.points[0].payload!['fileName'] as any;
    const handle = await instance.getGraph(name);
    handle.initGraph();

    // 添加节点
    await handle.add({
      nodes: [
        { chunkId, fileName, name: 'sn1', description: 'd1', type: 't1' },
      ],
      edges: [
        {
          chunkId,
          fileName,
          source: 'sn1',
          description: '',
          strength: 0,
          keywords: [],
          target: 'xx',
        },
      ],
    });
    let { points } = await qd.scroll(getGraphCollectionName(name));
    const point = points.find((item) => item.payload!['source'] === 'sn1')!;
    // 修改节点项
    ok(point);
    await handle.deleteNodeByName('sn1');
    ({ points } = await qd.scroll(getGraphCollectionName(name)));
    equal(
      points.filter(
        (item) =>
          item.payload!['kind'] === 'edge' && item.payload!['source'] === 'sn1',
      ).length,
      0,
    );
    equal(points.filter((item) => item.payload!['name'] === 'sn1').length, 0);
  });

  it('修改边', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'normal-graph',
      collectionList: [],
      name: name,
      activateCollection: '',
      maxChunkAsync: 1,
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const collection2 = {
      collectionName: 'collection2',
      size: 200,
    } as GraphCollectionInlineType;
    await instance.addCollection(name, collection2);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const qd = injector.get(QdrantClientService);
    const chunkResult = await qd.scroll(name);
    const chunkId = chunkResult.points[0].id as string;
    const fileName = chunkResult.points[0].payload!['fileName'] as any;
    const handle = await instance.getGraph(name);
    handle.initGraph();
    // 添加节点
    await handle.add({
      nodes: [],
      edges: [
        {
          chunkId,
          fileName,
          source: 'sn1',
          description: '',
          strength: 0,
          keywords: [],
          target: 'xx',
        },
      ],
    });
    let { points } = await qd.scroll(getGraphCollectionName(name));
    let point = points.find((item) => item.payload!['source'] === 'sn1')!;
    // 修改节点项
    ok(point);
    await handle.changeEdge(
      {
        ...point.payload,
        description: 'xxx',
        id: point.id,
      } as any,
      v.parse(EdgePayloadDefine, { ...point.payload, id: point.id }),
    );
    ({ points } = await qd.scroll(getGraphCollectionName(name)));
    point = points.find((item) => item.payload!['source'] === 'sn1')!;
    equal(point.payload!['description'], 'xxx');
  });
});
