import { env, pipeline } from '@huggingface/transformers';
import { MessagePort } from 'worker_threads';
import { FileProxyCache } from './custom-cache';
import type { DownloadConfigType } from '@cyia/external-call';
type PipeLineOptions = Partial<NonNullable<Parameters<typeof pipeline>[2]>>;
export interface InitOptions {
  /** 文件夹 */
  dir: string;
  /** 模型 */
  modelName: string;
  /** 模型参数 */
  options: PipeLineOptions;
  /**直接链接 */
  remoteHost: string;
  downloadConfig?: DownloadConfigType;
  port?: MessagePort;
  hfToken?: string;
}
export function setTransformersConfig(options: InitOptions) {
  env.useFS = false;
  env.localModelPath = options.dir;
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.cacheDir = options.dir;
  env.customCache = new FileProxyCache(options);
  env.useBrowserCache = false;
  env.useFSCache = true;
  env.useCustomCache = true;

  env.remoteHost = `https://${options.remoteHost}`;
}
