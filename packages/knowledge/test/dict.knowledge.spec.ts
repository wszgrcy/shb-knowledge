import { Injector } from 'static-injector';
import { ServerReturn, startServer } from '../../qdrant/test/util/start-server';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { deepStrictEqual, equal, ok } from 'assert';
import { getActivateCollectionName } from '../const';
import path from 'path';
import { getFixtureDir } from './util/get-fixture';
import * as fs from 'fs/promises';
import { createManager, TestManager } from './util/create-manager';
import { expect } from 'chai';
import { QD_RUNTIME_DIR } from '../../qdrant/test/util/qdrant-runtime-dir';
import { pathToFileURL } from 'url';
import { DictKnowledgeService } from '../dict/dict.knowledge.service';
describe('字典知识库', () => {
  let instance!: TestManager;
  let server: ServerReturn;
  let injector!: Injector;
  let tempDir: string;
  beforeEach(async () => {
    const { service, dir, create, qdStart } = await createManager({
      ocr: async (a) => 'hello',
    });
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
  it('字典创建知识库', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'dict',
      collectionList: [],
      name: name,
      activateCollection: '',
    });
    const vectorSize = 5;
    await instance.create(name, {
      collectionName: name,
      size: vectorSize,
    });
    const qd = injector.get(QdrantClientService);
    const { exists } = await qd.collectionExists(name);
    ok(exists);
    const { aliases } = await qd.getAliases();
    const item = aliases.find((item) => item.collection_name === name)!;
    equal(item?.alias_name, getActivateCollectionName(name));
    const data = await qd.getCollection(name);
    ok(data.payload_schema['word']);
    ok(data.payload_schema['content']);
    ok((data.config.params.vectors as any)['word']);
    ok((data.config.params.vectors as any)['chunk']);
    equal((data.config.params.vectors as any)['word'].size, vectorSize);
    equal((data.config.params.vectors as any)['chunk'].size, vectorSize);
  });
  it('导入字典', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'dict',
      collectionList: [],
      name: name,
      activateCollection: '',
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const qd = injector.get(QdrantClientService);
    await instance.importDict(name, {
      type: 'yaml',
      filePath: path.join(getFixtureDir(), 'dict.yml'),
    });
    const { points } = await qd.scroll(name, {
      limit: 9999,
      with_payload: true,
    });
    equal(points.length, 2);
    const point = points.find(
      (item) => item.payload!['word'] === 'word2',
    )!.payload!;
    equal(point['content'], 'content2');
    equal(point['chunk'], 'content2');
    equal(point['formatedContent'], 'content2');
    equal(point['word'], 'word2');
    ok(point['embeddingChunk']);
    deepStrictEqual(point['extra'], { k1: 'value1' });
    const dictInstance = (await instance.get('test1')) as DictKnowledgeService;
    const result = await dictInstance.searchWord('123', { limit: 10 });
    expect(result[0].payload).ok;
  });
  it('导入后添加集合/删除集合', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'dict',
      collectionList: [],
      name: name,
      activateCollection: '',
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const qd = injector.get(QdrantClientService);
    await instance.importDict(name, {
      type: 'yaml',
      filePath: path.join(getFixtureDir(), 'dict.yml'),
    });
    const collection2Config = {
      collectionName: 'collection2',
      size: 200,
    };
    await instance.addCollection(name, collection2Config);
    const { payload_schema } = await qd.getCollection(
      collection2Config.collectionName,
    );
    equal(Object.keys(payload_schema).length, 3);
    ok(payload_schema['word']);
    ok(payload_schema['content']);
    ok(payload_schema['chunk']);
    let { points } = await qd.scroll(collection2Config.collectionName, {
      limit: 999,
      with_payload: true,
      with_vector: true,
    });
    equal(points.length, 2);
    equal((points[0].vector as any)['word'].length, 200);

    ({ points } = await qd.scroll(name, {
      limit: 999,
      with_payload: true,
      with_vector: true,
    }));
    equal(points.length, 2);
    equal((points[0].vector as any)['word'].length, 100);

    ({ points } = await qd.scroll(getActivateCollectionName(name), {
      limit: 999,
      with_payload: true,
      with_vector: true,
    }));
    equal(points.length, 2);
    equal((points[0].vector as any)['word'].length, 200);
    // 测试添加集合后的集合信息
    const data = await qd.getCollection(collection2Config.collectionName);
    ok(data.payload_schema['word']);
    ok(data.payload_schema['content']);
    ok(data.payload_schema['chunk']);
    ok((data.config.params.vectors as any)['word']);
    ok((data.config.params.vectors as any)['chunk']);
    equal(
      (data.config.params.vectors as any)['word'].size,
      collection2Config.size,
    );
    equal(
      (data.config.params.vectors as any)['chunk'].size,
      collection2Config.size,
    );
    const client = await qd.originClient;

    // 切换集合回原来
    await instance.changeActivateCollection(name, name);
    const { aliases } = await qd.getAliases();
    const item = aliases.find((item) => item.collection_name === name)!;
    ok(item);
    // 删除添加的集合
    await instance.deleteCollection(name, collection2Config.collectionName);
    const eresult = await client.getCollections();
    equal(eresult.collections.length, 1);
    equal(eresult.collections[0].name, name);
  });
  it('销毁', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    instance.addConfig({
      type: 'dict',
      collectionList: [],
      name: name,
      activateCollection: '',
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const qd = injector.get(QdrantClientService);
    await instance.importDict(name, {
      type: 'yaml',
      filePath: path.join(getFixtureDir(), 'dict.yml'),
    });
    const collection2Config = {
      collectionName: 'collection2',
      size: 200,
    };
    await instance.addCollection(name, collection2Config);

    // 调用销毁测试
    await instance.destroy(name);
    const client = await qd.originClient;
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
  it('导出/导入', async () => {
    const name = 'test1';
    instance.addConfig({
      type: 'dict',
      collectionList: [],
      name: name,
      activateCollection: '',
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const qd = await injector.get(QdrantClientService).originClient;
    await instance.importDict(name, {
      type: 'yaml',
      filePath: path.join(getFixtureDir(), 'dict.yml'),
    });
    const collection2Config = {
      collectionName: 'collection2',
      size: 200,
    };
    await instance.addCollection(name, collection2Config);
    // 导出
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
      type: 'dict',
    });
    const [{ collections }, { aliases }] = await Promise.all([
      qd.getCollections(),
      qd.getAliases(),
    ]);
    // 两个collection
    expect(collections.length).eq(2);
    expect(aliases.length).eq(1);
  });
  it.skip('ocr', async () => {
    const name = 'test1';
    instance.addConfig({
      type: 'dict',
      collectionList: [],
      name: name,
      activateCollection: '',
      useOcr: true,
    });
    await instance.create(name, {
      collectionName: name,
      size: 100,
    });
    const qd = await injector.get(QdrantClientService).originClient;
    await instance.importDict(name, {
      type: 'mdict',
      filePath: path.join(
        process.cwd(),
        './packages/file-parser/test/fixture',
        '最新英汉百科图解大词典.mdx',
      ),
    });
    const result = await qd.scroll(name, { limit: 999 });
    result;
  });
});
