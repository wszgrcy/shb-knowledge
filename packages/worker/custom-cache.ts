import { env } from '@huggingface/transformers';
import { createNormalizeVfs, path } from '@cyia/vfs2';
import { downloadFile } from '@cyia/dl';
import fs from 'fs';
import { InitOptions } from './set-transformers-config';
export interface NodeProxy {
  match: (request: string) => Promise<ArrayBuffer | undefined>;
  put: (request: string, arraybuffer: ArrayBuffer) => Promise<void>;
}
export class FileProxyCache {
  #path;
  #vfs;
  #sendMessage;
  #modelName;
  #downloadConfig;
  #initOptions;
  #downloadPromises = new Map<
    string,
    Promise<
      | {
          getFilePath: () => string;
        }
      | undefined
    >
  >();
  constructor(initOptions: InitOptions) {
    this.#modelName = initOptions.modelName;
    this.#sendMessage = (message: any) => {
      initOptions.port?.postMessage({ type: 'progress', message });
    };
    this.#path = initOptions.dir;
    this.#vfs = createNormalizeVfs({ dir: initOptions.dir });
    this.#downloadConfig = initOptions.downloadConfig;
    this.#initOptions = initOptions;
  }
  async #createResponse(filePath: string): Promise<Response> {
    const stats = await fs.promises.stat(filePath);
    const extension = filePath.split('.').pop()!.toLowerCase();
    const contentType =
      (CONTENT_TYPE_MAP as any)[extension] ?? 'application/octet-stream';
    const stream = fs.createReadStream(filePath);
    return new Response(stream, {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': contentType,
        'content-length': stats.size.toString(),
      },
    });
  }
  async match(request: string): Promise<Response | undefined> {
    let filePath;
    if (request.startsWith('http')) {
      const data = new URL(request);
      filePath = path.join(
        this.#path,
        data.pathname.replace(
          '/' +
            env.remotePathTemplate
              .replaceAll('{model}', this.#modelName)
              .replaceAll('{revision}', encodeURIComponent('main')),
          `/${this.#modelName}/`,
        ),
      );

      if (this.#downloadPromises.has(request)) {
        await this.#downloadPromises.get(request);
      } else {
        const downloadPromise = downloadFile(request, {
          ...this.#downloadConfig,
          savePath: filePath,
          message: this.#sendMessage,
          headers: {
            token: this.#initOptions?.hfToken ?? '',
            'software-bbs': 'bbs.shenghuabi.site',
          },
        });
        this.#downloadPromises.set(request, downloadPromise);
        await downloadPromise;
      }
    } else {
      filePath = request;
    }
    const exists = await this.#vfs.exists(filePath);
    if (exists) {
      return this.#createResponse(filePath);
    }
    return undefined;
  }

  async put(request: string, response: Response): Promise<void> {
    throw new Error('no put');
  }
}
const CONTENT_TYPE_MAP: Record<string, string> = {
  txt: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
};
