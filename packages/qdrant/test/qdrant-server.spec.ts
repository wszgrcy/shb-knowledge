import {
  DownloadConfigToken,
  GITHUB_URL_TOKEN,
  LogFactoryToken,
  LogService,
} from '@cyia/external-call';
import { QdrantServerService } from '../qdrant-server.service';
import {
  ChangeDetectionScheduler,
  ChangeDetectionSchedulerImpl,
  computed,
  createRootInjector,
} from 'static-injector';
import { existsSync } from 'fs';
import path from 'path';
import { QdrantOptionsDefine, QdrantOptionsToken } from '../type';
import * as v from 'valibot';
import { expect } from 'chai';
describe.skip('server', () => {
  const dir = path.join(process.cwd(), 'bin', 'qdrant-server');

  const providers = [
    QdrantServerService,
    {
      provide: GITHUB_URL_TOKEN,
      useValue: computed(() =>
        false ? 'github.com' : 'github-release.tbontop.top',
      ),
    },
    {
      provide: DownloadConfigToken,
      useValue: computed(() => {}),
    },
    {
      provide: QdrantOptionsToken,
      useValue: computed(() =>
        v.parse(QdrantOptionsDefine, { dir: dir, port: 5555 }),
      ),
    },

    LogService,
    {
      provide: LogFactoryToken,
      useValue: () => ({
        info: (...args: any[]) => {
          console.log(...args);
        },
        warn: (...args: any[]) => {
          console.log(...args);
        },
        error: (...args: any[]) => {
          console.log(...args);
        },
      }),
    },
    {
      provide: ChangeDetectionScheduler,
      useClass: ChangeDetectionSchedulerImpl,
    },
  ];
  it('download', async () => {
    const injector = createRootInjector({
      providers: providers,
    });
    const instance = injector.get(QdrantServerService);
    await instance.downloadExec({
      progressMessage: (item) => {
        console.log(item);
      },
    });
    existsSync(
      path.join(dir, process.platform === 'win32' ? 'qdrant.exe' : 'qdrant'),
    );
    await instance.init();
    expect(instance.start$()).true;
    const result = await instance.checkVersion('9.9.9');
    expect(result).true;
    await instance.stop();
  });
});
