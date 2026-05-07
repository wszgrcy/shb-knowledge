import { Injector } from 'static-injector';
import { ServerReturn, startServer } from '../../qdrant/test/util/start-server';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { equal, ok } from 'assert';
import { getActivateCollectionName } from '../const';
import path from 'path';
import { getFixtureDir } from './util/get-fixture';
import * as fs from 'fs/promises';
import { createManager, TestManager } from './util/create-manager';
import { expect } from 'chai';
import { QD_RUNTIME_DIR } from '../../qdrant/test/util/qdrant-runtime-dir';
import { pathToFileURL } from 'url';
import { eq } from 'lodash-es';
describe('普通知识库', () => {
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
      type: 'normal',
      collectionList: [],
      name: name,
      activateCollection: name,
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
    const data = await qd.getCollection(name);
    ok(data.payload_schema['fileName']);
  });
  it('空集合名?', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: name,
      maxEmbeddingAsync: 999,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: '', size: 100, chunkSize: 100 };
    try {
      await instance.create(name, collectionItem);
    } catch (error) {
      if (error instanceof Error) {
        eq(error.message, 'Not Found');
        return;
      }
      throw new Error('其他异常', { cause: error });
    }
    throw new Error('');
  });
  it('空内容', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: name,
      maxEmbeddingAsync: 999,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);
    const qd = injector.get(QdrantClientService);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'empty.txt')]);
    const client = await qd.originClient;
    const result = await client.scroll(name, { limit: 1 });
    eq(result.points.length, 0);
  });
  it('空模板格式化', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: name,
      maxEmbeddingAsync: 999,
    };
    instance.addConfig(config);
    const collectionItem = {
      collectionName: name,
      size: 100,
      chunkSize: 100,
      embeddingTemplate: { entry: { enable: true, value: ' ' } },
    };
    await instance.create(name, collectionItem);
    const qd = injector.get(QdrantClientService);
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const client = await qd.originClient;
    const result = await client.scroll(name, { limit: 1 });
    eq(result.points.length, 0);
  });
  it('插入内容/删除内容', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: name,
      maxEmbeddingAsync: 999,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);

    const qd = injector.get(QdrantClientService);

    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const client = await qd.originClient;
    let result = await client.scroll(name, { limit: 9999 });
    ok(result.points.length);
    await instance.deleteItem(name, 'doc');
    let isDelete = false;
    try {
      const status = await fs.stat(path.join(dir, name, 'doc'));
    } catch (error) {
      isDelete = true;
    }
    ok(isDelete);
    result = await client.scroll(name, { limit: 9999 });
    ok(!result.points.length);
    const ab = new AbortController();
    ab.abort();
    await instance.importFiles(
      name,
      [path.join(getFixtureDir(), 'doc.txt')],
      ab.signal,
    );
    result = await client.scroll(name, { limit: 9999 });
    ok(!result.points.length);
  });
  it('增加集合/删除集合', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal' as const,
      collectionList: [] as any[],
      name: name,
      dir,
      activateCollection: name,
      maxEmbeddingAsync: 999,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);

    const qd = injector.get(QdrantClientService);

    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const client = await qd.originClient;
    let result = await client.scroll(name, { limit: 9999 });
    const length = result.points.length;
    const collection2Name = 'collection2';
    const collection2Item = {
      collectionName: collection2Name,
      size: 200,
    };
    await instance.addCollection(name, collection2Item);
    const { payload_schema } = await client.getCollection(
      collection2Item.collectionName,
    );
    ok(payload_schema['fileName']);
    equal(Object.keys(payload_schema).length, 1);

    result = await client.scroll(collection2Name, {
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
    // 切换集合回原来
    await instance.changeActivateCollection(name, name);
    const { aliases } = await qd.getAliases();
    const item = aliases.find((item) => item.collection_name === name)!;
    ok(item);
    // 删除添加的集合
    await instance.deleteCollection(name, collection2Item.collectionName);
    const eresult = await client.getCollections();
    equal(eresult.collections.length, 1);
    equal(eresult.collections[0].name, name);
  });

  it('增加集合后增加文件', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal' as const,
      collectionList: [] as any[],
      name: name,
      dir,
      activateCollection: name,
      maxEmbeddingAsync: 999,
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
    // 更新文件
    await instance.updateItem(name, 'doc', 'helloWord');
    result = await client.scroll(name, {
      limit: 9999,
      with_vector: true,
    });
    ok(
      result.points.some((point) =>
        (point.payload!['chunk'] as string).includes('helloWord'),
      ),
    );
    ok(
      !result.points.some((point) =>
        (point.payload!['chunk'] as string).includes('测试内容'),
      ),
    );

    // 调用销毁测试
    await instance.destroy(name);
    const [{ collections }, { aliases }] = await Promise.all([
      client.getCollections(),
      client.getAliases(),
    ]);
    expect(collections.length).eq(0);
    expect(aliases.length).eq(0);
    try {
      const status = await fs.stat(path.join(dir, name));
    } catch (error) {
      return true;
    }
    throw new Error('');
  });
  it('添加模板', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'normal' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: name,
      maxEmbeddingAsync: 999,
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
      },
    });

    const qd = injector.get(QdrantClientService);

    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const client = await qd.originClient;
    const { points } = await client.scroll(name, {
      limit: 9999,
      with_payload: true,
    });
    ok(points.length);
    equal(points[0].payload!['embeddingChunk'], 'test1|doc');
  });

  it('导出/导入', async () => {
    const name = 'test1';
    const config = {
      type: 'normal' as const,
      collectionList: [],
      name: name,
      activateCollection: name,
      maxEmbeddingAsync: 999,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);
    const qd = await injector.get(QdrantClientService).originClient;
    await instance.importFiles(name, [path.join(getFixtureDir(), 'doc.txt')]);
    const result = await instance.export(name);
    const dir2 = path.join(QD_RUNTIME_DIR, 'snapshots');
    await instance.destroy(name);

    await instance.import(name, {
      snapshotList: result.map((item) => ({
        collection: item.collection,
        checksum: item.checksum,
        filePath: pathToFileURL(
          path.join(dir2, item.collection, item.name!),
        ).toString(),
      })),
      activateCollection: name,
      type: 'normal',
    });
    const [{ collections }, { aliases }] = await Promise.all([
      qd.getCollections(),
      qd.getAliases(),
    ]);
    expect(collections.length).eq(1);
    expect(aliases.length).eq(1);
  });
});
