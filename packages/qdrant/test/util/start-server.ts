import { path } from '@cyia/vfs2';
import * as fs from 'fs';
import { withResolvers } from './promise';
import { spawn } from 'child_process';
import { QD_RUNTIME_DIR } from './qdrant-runtime-dir';

export async function startServer() {
  const cwd = process.cwd();
  await fs.promises.mkdir(QD_RUNTIME_DIR, { recursive: true });
  const exeFile = path.join(cwd, 'bin', 'qdrant/qdrant.exe');
  const start = withResolvers();
  const instance = spawn(exeFile, {
    cwd: QD_RUNTIME_DIR,
    env: { QDRANT__SERVICE__HTTP_PORT: '5432' },
    // stdio: 'inherit'
  });
  //   instance.on('')
  instance.stdout?.on('data', (message) => {
    if (message.toString().includes('HTTP listening')) {
      start.resolve();
    }
  });
  await start.promise;
  // todo 删除
  return {
    // start$$: start.promise,
    dispose: () => {
      const end = withResolvers();
      instance.on('close', () => {
        fs.promises
          .rm(QD_RUNTIME_DIR, { recursive: true, force: true })
          .then(() => {
            end.resolve();
          });
      });
      instance.kill();
      return end.promise;
    },
  };
}
export type ServerReturn = Awaited<ReturnType<typeof startServer>>;
