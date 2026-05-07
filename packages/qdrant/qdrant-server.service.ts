import { computed, inject, signal } from 'static-injector';
import { QdrantOptionsToken } from './type';
import { path } from '@cyia/vfs2';
import { ExternalCallBaseService } from '@cyia/external-call';
import { getQdrantFile } from './util';
import type { DownloadFileOptions } from '@cyia/dl';
const fileName = 'qdrant' + (process.platform === 'win32' ? '.exe' : '');
type ExecInstance = ReturnType<ExternalCallBaseService['exec']>;
export class QdrantServerService extends ExternalCallBaseService {
  override logName = 'qdrant';
  #config = inject(QdrantOptionsToken);
  #fileName = computed(() => fileName);
  override startPath$$ = computed(() =>
    path.join(this.#config().dir, this.#fileName()),
  );
  override execPath$$ = this.startPath$$;
  override checkFilePath$$ = this.startPath$$;
  snapshotDir$$ = computed(() => path.join(this.#config().dir, 'snapshots'));
  /** 启动时读取 */
  #version?: string;
  start$ = signal(false);
  #startFinished$?: Promise<ReturnType<typeof this.exec>>;

  override async init() {
    await this.startup();
  }
  async startup() {
    await this.checkExist();
    const exist = await this.exist();
    if (!exist) {
      return undefined;
    }
    if (!this.#startFinished$) {
      this.#startFinished$ = this.#startup();
    }
    return this.#startFinished$;
  }
  #startup() {
    return new Promise<ExecInstance>(async (resolve, reject) => {
      this.log?.info(`准备启动`);
      const { instance, abortController } = this.exec(
        this.startPath$$(),
        await this.#getOptions(),
        {
          env: await this.#getEnv(),
          extendEnv: true,
          cwd: this.#config().dir,
          reject: false,
        },
      );
      this.instanceSnapshot = [instance];
      let httpEnable = false;
      let grpcEnable = false;
      instance.stdout.on('data', (data: Buffer) => {
        const value = data.toString();
        if (!this.start$() || !value.includes('/points?wait=false')) {
          this.log?.info(value);
        }
        if (!grpcEnable && value.includes('gRPC listening')) {
          grpcEnable = true;
        }
        if (!httpEnable && value.includes('HTTP listening')) {
          httpEnable = true;
        }
        if (!this.start$() && grpcEnable && httpEnable) {
          this.log?.info(`启动成功`);
          this.start$.set(true);
          resolve({ instance, abortController });
        }
        if (!this.#version) {
          const result = value.match(/Version:\s+([^,]+)/);
          if (result) {
            this.#version = result[1];
          }
        }
      });
    });
  }
  async #getEnv() {
    const env: Record<string, any> = {};
    const port = this.#config().port;
    if (port) {
      env['QDRANT__SERVICE__HTTP_PORT'] = port;
    }
    return env;
  }
  async #getOptions() {
    const list: string[] = [];
    const configPath = this.#config().configPath;
    if (configPath) {
      list.push('--config-path', configPath);
    }
    return list;
  }

  protected override async getVersion(): Promise<string | undefined> {
    await this.checkExist();
    if (!this.exist$()) {
      return undefined;
    }
    return this.#version;
  }

  override stop() {
    try {
      super.stop();
    } catch (error) {
      this.log?.error(error);
    } finally {
      this.#startFinished$ = undefined;
      this.start$.set(false);
    }
  }
  #downloadExecAbort?: AbortController;

  async downloadExec(options?: {
    progressMessage?: DownloadFileOptions['message'];
  }) {
    await this.stop();
    this.#downloadExecAbort?.abort();
    const ac = new AbortController();
    this.#downloadExecAbort = ac;
    try {
      await this.githubRepoDownload(
        {
          prefix: `qdrant/qdrant`,
          version: this.#config().version,
          fileName: getQdrantFile(),
        },
        {
          output: this.#config().dir,
          progressMessage: options?.progressMessage,
          cleanDir: false,
          signal: ac.signal,
        },
      );
    } catch (error) {
      if (ac.signal.aborted) {
        return;
      }
      throw error;
    }
  }
}
