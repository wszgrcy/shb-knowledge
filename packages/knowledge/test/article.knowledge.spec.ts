import { Injector } from 'static-injector';
import { ServerReturn, startServer } from '../../qdrant/test/util/start-server';
import { QdrantClientService } from '@shenghuabi/knowledge/qdrant';
import { equal, ok } from 'assert';
import { getActivateCollectionName } from '../const';
import path from 'path';
import * as fs from 'fs/promises';
import { createManager, TestManager } from './util/create-manager';
import { expect } from 'chai';
import { ArticleKnowledgeService } from '../article';
describe('文章知识库', () => {
  let instance!: TestManager;
  let server: ServerReturn;
  let injector!: Injector;
  let tempDir: string;
  const DIR = path.join(process.cwd(), './packages/knowledge/test/fixture');
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
      type: 'article',
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
    const { payload_schema } = await qd.getCollection(name);
    ok(payload_schema['fullName']);
    ok(payload_schema['dir']);
    ok(payload_schema['fileHash']);
    equal(Object.keys(payload_schema).length, 3);
  });
  it('插入内容/删除内容', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'article' as const,
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
    await instance.importTextFile(name, DIR, ['doc.txt']);
    const client = await qd.originClient;
    let result = await client.scroll(name, { limit: 9999 });
    ok(result.points.length);
    await instance.deleteItem(name, 'doc.txt');
    result = await client.scroll(name, { limit: 9999 });
    ok(!result.points.length);
    const ab = new AbortController();
    ab.abort();
    await instance.importTextFile(name, DIR, ['doc.txt'], ab.signal);
    result = await client.scroll(name, { limit: 9999 });
    ok(!result.points.length);
  });
  it('增加集合/删除集合', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'article' as const,
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

    await instance.importTextFile(name, DIR, ['doc.txt']);
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
    ok(payload_schema['fullName']);
    ok(payload_schema['dir']);
    ok(payload_schema['fileHash']);
    equal(Object.keys(payload_schema).length, 3);

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
      type: 'article' as const,
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
    await instance.importTextFile(name, DIR, ['doc.txt']);

    let result = await client.scroll(name, { limit: 9999, with_vector: true });
    ok(result.points.length);
    equal((result.points[0].vector as any)!['chunk'].length, 100);
    result = await client.scroll(collection2Name, {
      limit: 9999,
      with_vector: true,
    });
    ok(result.points.length);
    equal((result.points[0].vector as any)!['chunk'].length, 200);

    // 调用销毁测试
    await instance.destroy(name);
    const [{ collections }, { aliases }] = await Promise.all([
      client.getCollections(),
      client.getAliases(),
    ]);
    expect(collections.length).eq(0);
    expect(aliases.length).eq(0);

    const status = await fs.stat(DIR);
    ok(status);
  });

  it('搜索内容', async () => {
    const name = 'test1';
    const dir = instance.tempDir;
    const config = {
      type: 'article' as const,
      collectionList: [],
      name: name,
      dir,
      activateCollection: name,
      maxEmbeddingAsync: 999,
    };
    instance.addConfig(config);
    const collectionItem = { collectionName: name, size: 100, chunkSize: 100 };
    await instance.create(name, collectionItem);
    await instance.importTextFile(name, DIR, ['doc.txt']);
    const result = (await instance.get('test1')) as ArticleKnowledgeService;
    const searchResult = await result.searchChunk('123');
    expect(searchResult[0].payload).ok;
  });
});
