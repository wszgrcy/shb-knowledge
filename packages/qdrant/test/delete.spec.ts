import { QdrantClient } from '@qdrant/qdrant-js';
import path from 'path';
import { spawn } from 'child_process';
import { withResolvers } from './util/promise';
import { v4 } from 'uuid';
import * as fs from 'fs';
import { ok } from 'assert';
async function startServer() {
  const cwd = process.cwd();
  const tempDir = path.join(cwd, '.tmp', v4());
  await fs.promises.mkdir(tempDir, { recursive: true });
  const exeFile = path.join(cwd, 'bin', 'qdrant/qdrant.exe');
  const start = withResolvers();
  const instance = spawn(exeFile, {
    cwd: tempDir,
    // env: { QDRANT__SERVICE__HTTP_PORT: '6333' },
    // stdio: 'inherit'
  });
  //   instance.on('')
  instance.stdout?.on('data', (message) => {
    console.log(message.toString());
    if (message.toString().includes('HTTP listening')) {
      start.resolve();
    }
  });
  // todo 删除
  return {
    start$$: start.promise,
    dispose: () => {
      const end = withResolvers();
      instance.on('close', () => {
        fs.promises.rm(tempDir, { recursive: true, force: true });
        end.resolve();
      });
      instance.kill();
      return end.promise;
    },
  };
}
describe.skip('删除', () => {
  let server;
  beforeEach(async () => {
    server = await startServer();
    await server.start$$;
  });
  afterEach(async () => {
    await server!.dispose();
  });
  it('删除(1.12.4-1.13.4异常)', async () => {
    const client = new QdrantClient({ host: '127.0.0.1', port: 6333 });
    const collection_name = 'test1';
    await client.createCollection(collection_name, {
      vectors: { size: 500, distance: 'Cosine' },
    });
    const { exists } = await client.collectionExists(collection_name);
    ok(exists);
    const a = await client.deleteCollection(collection_name);
    ok(a);
  });
});
