import { path } from '@cyia/vfs2';
import * as fs from 'fs';
import { withResolvers } from './promise';
import { spawn } from 'child_process';
import { QD_RUNTIME_DIR } from './qdrant-runtime-dir';
let dispose: () => Promise<any>;
export async function startServer() {
  const cwd = process.cwd();
  await fs.promises.mkdir(QD_RUNTIME_DIR, { recursive: true });
  const exeFile = path.join(
    cwd,
    'bin',
    process.platform === 'win32'
      ? `qdrant-server/qdrant.exe`
      : `qdrant-server/qdrant`,
  );
  let qdExist = fs.existsSync(exeFile);
  if (!qdExist) {
    throw new Error(`服务端不存在,${exeFile}`);
  }
  console.log(QD_RUNTIME_DIR, exeFile);

  const start = withResolvers();
  if (dispose) {
    await dispose?.();
  }
  const instance = spawn(exeFile, {
    cwd: QD_RUNTIME_DIR,
    env: { QDRANT__SERVICE__HTTP_PORT: '5432' },
  });

  instance.stdout?.on('data', (data) => {
    let message = data.toString();
    if (process.env.CI) {
      console.log(message);
    }
    if (message.includes('HTTP listening')) {
      start.resolve();
    }
  });
  await start.promise;
  let disposed = false;
  // todo 删除
  dispose = async () => {
    if (disposed) {
      return;
    }
    const end = withResolvers();
    instance.on('close', () => {
      fs.promises
        .rm(QD_RUNTIME_DIR, { recursive: true, force: true })
        .then(() => {
          end.resolve();
        });
    });
    instance.kill();
    disposed = true;
    return end.promise;
  };
  return {
    // start$$: start.promise,
    dispose: dispose,
  };
}
export type ServerReturn = Awaited<ReturnType<typeof startServer>>;
