import { Injector } from 'static-injector';
import { ServerReturn, startServer } from '../../qdrant/test/util/start-server';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { equal, ok } from 'assert';
import { getActivateCollectionName, getGraphCollectionName } from '../const';
import path from 'path';
import { getFixtureDir } from './util/get-fixture';
import * as fs from 'fs/promises';
import { createManager, TestManager } from './util/create-manager';
import { expect } from 'chai';
import { QD_RUNTIME_DIR } from '../../qdrant/test/util/qdrant-runtime-dir';
import { pathToFileURL } from 'url';
describe('图谱知识库', () => {
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
  it('创建', async () => {
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
      size: 5,
    });
    const qd = injector.get(QdrantClientService);
    const { exists } = await qd.collectionExists(name);
    ok(exists);
    const { aliases } = await qd.getAliases();
    const item = aliases.find((item) => item.collection_name === name)!;
    equal(item?.alias_name, getActivateCollectionName(name));
    let data = await qd.getCollection(getGraphCollectionName(name));
    ok(data.payload_schema['fileName']);
    ok(data.payload_schema['kind']);
    ok(data.payload_schema['name']);
    data = await qd.getCollection(name);
    ok(data.payload_schema['fileName']);
  });
  it('插入内容/删除内容', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal-graph' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: '',
      maxChunkAsync: 1,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);

    const qd = injector.get(QdrantClientService);

    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const client = await qd.originClient;
    let result = await client.scroll(name, { limit: 9999 });
    ok(result.points.length);

    result = await client.scroll(getGraphCollectionName(name), { limit: 9999 });
    ok(result.points.length);
    equal(result.points.length, 3);
    const node = result.points.find(
      (item) => item.payload!['kind'] === 'node',
    )?.payload!;
    equal(node.name, 'n1');
    equal(node.description, 'd1');
    const edge = result.points.find(
      (item) => item.payload!['kind'] === 'edge',
    )?.payload!;
    equal(edge.source, 's1');
    equal(edge.target, 'd1');
    equal(edge.name, 's1,d1');
    ok('strength' in edge);
    ok('description' in edge);
    const keyword = result.points.find(
      (item) => item.payload!['kind'] === 'keyword',
    )?.payload!;

    ok('keyword' in keyword);

    await instance.deleteItem(name, 'doc');
    result = await client.scroll(name, { limit: 9999 });
    ok(!result.points.length);
    result = await client.scroll(getGraphCollectionName(name), { limit: 9999 });
    ok(!result.points.length);
  });
  it('增加集合/删除集合', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal-graph' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: '',
      maxChunkAsync: 1,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);

    const qd = injector.get(QdrantClientService);

    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const client = await qd.originClient;
    let result = await client.scroll(name, { limit: 9999 });
    const length = result.points.length;
    const collection2Item = {
      collectionName: 'collection2',
      size: 200,
    };
    await instance.addCollection(name, collection2Item);
    const { payload_schema } = await client.getCollection(
      getGraphCollectionName(collection2Item.collectionName),
    );
    ok(payload_schema['kind']);
    ok(payload_schema['fileName']);
    ok(payload_schema['name']);
    ok(payload_schema['source']);
    ok(payload_schema['target']);
    equal(Object.keys(payload_schema).length, 5);
    result = await client.scroll(collection2Item.collectionName, {
      limit: 9999,
      with_vector: true,
    });
    equal(result.points.length, length);
    equal((result.points[0].vector as any)!['chunk'].length, 200);
    result = await client.scroll(getActivateCollectionName(name), {
      limit: 9999,
      with_vector: true,
    });
    equal(result.points.length, length);
    equal((result.points[0].vector as any)!['chunk'].length, 200);

    // 查看激活集合
    result = await client.scroll(
      getActivateCollectionName(getGraphCollectionName(name)),
      { limit: 9999, with_vector: true },
    );
    equal((result.points[0].vector as any)!['chunk'].length, 200);
    equal(result.points.length, 3);

    // 切换集合回原来
    await instance.changeActivateCollection(name, name);
    const { aliases } = await qd.getAliases();
    equal(aliases.length, 2);
    ok(aliases.some((item) => item.collection_name === name)!);
    ok(
      aliases.some(
        (item) => item.collection_name === getGraphCollectionName(name),
      )!,
    );
    // 删除添加的集合
    await instance.deleteCollection(name, collection2Item.collectionName);
    const eresult = await client.getCollections();
    equal(eresult.collections.length, 2);
    ok(eresult.collections.some((item) => item.name === name));
    ok(
      eresult.collections.some(
        (item) => item.name === getGraphCollectionName(name),
      ),
    );
  });

  it('增加集合后增加文件', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal-graph' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: 'test1',
      maxChunkAsync: 1,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);
    config.collectionList = [collectionItem] as any;
    instance.addConfig(config);
    const qd = injector.get(QdrantClientService);

    const client = await qd.originClient;
    const collection2Name = 'collection2';
    const collection2Item = {
      collectionName: collection2Name,
      size: 200,
    };
    await instance.addCollection(name, collection2Item);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    let result = await client.scroll(name, { limit: 9999, with_vector: true });
    ok(result.points.length);
    equal((result.points[0].vector as any)!['chunk'].length, 100);

    result = await client.scroll(collection2Name, {
      limit: 9999,
      with_vector: true,
    });
    ok(result.points.length);
    equal((result.points[0].vector as any)!['chunk'].length, 200);

    result = await client.scroll(getGraphCollectionName(name), {
      limit: 9999,
      with_vector: true,
    });
    ok(result.points.length);
    equal(result.points.length, 3);
    equal((result.points[0].vector as any)!['chunk'].length, 100);
    result = await client.scroll(
      getActivateCollectionName(getGraphCollectionName(name)),
      { limit: 9999, with_vector: true },
    );
    ok(result.points.length);
    equal(result.points.length, 3);
    equal((result.points[0].vector as any)!['chunk'].length, 200);

    // 主动抛异常,测试恢复
    const config1 = instance.map.get(name)!;
    let hasError = false;
    instance.map.set(name, config1);
    const tempName = '11113';
    try {
      await instance.addCollection(name, {
        ...collection2Item,
        collectionName: tempName,
      });
    } catch (error) {
      hasError = true;
      const result = await Promise.all([
        qd.collectionExists(tempName),
        qd.collectionExists(getGraphCollectionName(tempName)),
      ]);
      ok(!result[0].exists);
      ok(!result[1].exists);
    }
    ok(hasError);
    // 调用销毁测试
    await instance.destroy(name);
    const [{ collections }, { aliases }] = await Promise.all([
      client.getCollections(),
      client.getAliases(),
    ]);
    expect(collections.length).eq(0);
    expect(aliases.length).eq(0);
    try {
      await fs.stat(path.join(dir, name));
    } catch (error) {
      return true;
    }
    throw new Error('');
  });
  it('添加模板', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal-graph' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: '',
      maxChunkAsync: 1,
    };
    instance.addConfig(config);
    await instance.create(name, {
      collectionName: name,
      size: 100,
      embeddingTemplate: {
        entry: {
          enable: true,
          value: '{{ENTRY.knowledge}}|{{ENTRY.fileName}}',
        },
        node: {
          enable: true,
          value: '{{ENTRY.knowledge}}|{{ENTRY.fileName}}|node',
        },
        edge: {
          enable: true,
          value: '{{ENTRY.knowledge}}|{{ENTRY.fileName}}|edge',
        },
      },
    });

    const qd = injector.get(QdrantClientService);

    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const client = await qd.originClient;
    let { points } = await client.scroll(name, {
      limit: 9999,
      with_payload: true,
    });
    ok(points.length);
    equal(points[0].payload!['embeddingChunk'], 'test1|doc');
    ({ points } = await client.scroll(getGraphCollectionName(name), {
      limit: 9999,
      with_payload: true,
    }));
    let node = points.find(
      (item) => item.payload!['kind'] === 'node',
    )?.payload!;
    equal(node['embeddingChunk'], 'test1|doc|node');
    let edge = points.find(
      (item) => item.payload!['kind'] === 'edge',
    )?.payload!;
    equal(edge['embeddingChunk'], 'test1|doc|edge');

    // 添加一个集合
    const config2 = {
      collectionName: 'collection2',
      size: 200,
      embeddingTemplate: {
        entry: {
          enable: true,
          value: '111{{ENTRY.knowledge}}|{{ENTRY.fileName}}',
        },
        node: {
          enable: true,
          value: '222{{ENTRY.knowledge}}|{{ENTRY.fileName}}|node',
        },
        edge: {
          enable: true,
          value: '333{{ENTRY.knowledge}}|{{ENTRY.fileName}}|edge',
        },
      },
    };
    await instance.addCollection(name, config2);
    ({ points } = await client.scroll(
      getGraphCollectionName(config2.collectionName),
      { limit: 9999, with_payload: true },
    ));
    node = points.find((item) => item.payload!['kind'] === 'node')?.payload!;
    equal(node['embeddingChunk'], '222test1|doc|node');
    edge = points.find((item) => item.payload!['kind'] === 'edge')?.payload!;
    equal(edge['embeddingChunk'], '333test1|doc|edge');
    ({ points } = await client.scroll(config2.collectionName, {
      limit: 9999,
      with_payload: true,
    }));
    const point2 = points[0].payload!;
    equal(point2['embeddingChunk'], '111test1|doc');
  });

  it('导出/导入', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal-graph' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: 'test1',
      maxChunkAsync: 1,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);
    config.collectionList = [collectionItem] as any;
    instance.addConfig(config);
    const qd = await injector.get(QdrantClientService).originClient;

    const collection2Name = 'collection2';
    const collection2Item = {
      collectionName: collection2Name,
      size: 200,
    };
    await instance.addCollection(name, collection2Item);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    // 导出
    const result = await instance.export(name);
    const dir2 = path.join(QD_RUNTIME_DIR, 'snapshots');
    await instance.destroy(name);
    // 导入
    await instance.import(name, {
      snapshotList: result.map((item) => ({
        collection: item.collection,
        checksum: item.checksum,
        filePath: pathToFileURL(
          path.join(dir2, item.collection, item.name!),
        ).toString(),
      })),
      activateCollection: name,
      type: 'normal-graph',
    });
    const [{ collections }, { aliases }] = await Promise.all([
      qd.getCollections(),
      qd.getAliases(),
    ]);
    // 两个collection
    expect(collections.length).eq(4);
    expect(aliases.length).eq(2);
  });

  it('插入前直接终止', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal-graph' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: '',
      maxChunkAsync: 1,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);
    const qd = injector.get(QdrantClientService);
    const ab = new AbortController();
    ab.abort();
    await instance.importFiles(
      name,
      [path.join(getFixtureDir(), 'doc.txt')],
      ab.signal,
    );
    const client = await qd.originClient;
    const result = await client.scroll(name, { limit: 9999 });
    ok(!result.points.length);
  });
});
