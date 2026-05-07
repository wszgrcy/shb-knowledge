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
  async match(request: string): Promise<FileResponse | undefined> {
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

      await downloadFile(request, {
        ...this.#downloadConfig,
        savePath: filePath,
        message: this.#sendMessage,
        headers: {
          token: this.#initOptions?.hfToken ?? '',
          'software-bbs': 'bbs.shenghuabi.site',
        },
      });
    } else {
      filePath = request;
    }
    const exists = await this.#vfs.exists(filePath);
    if (exists) {
      return new FileResponse(filePath);
    }
    return undefined;
  }

  async put(request: string, response: Response | FileResponse): Promise<void> {
    throw new Error('no put');
  }
}
const decoder = new TextDecoder('utf-8');
const CONTENT_TYPE_MAP = {
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
class FileResponse {
  filePath;
  headers;
  exists = true;
  status = 200;
  statusText = 'OK';
  body;
  constructor(filePath: string) {
    this.filePath = filePath;
    this.headers = new Headers();

    this.updateContentType();

    this.body = fs.createReadStream(filePath);
  }

  updateContentType() {
    const stats = fs.statSync(this.filePath);
    this.headers.set('content-length', stats.size.toString());

    const extension = this.filePath.toString().split('.').pop()!.toLowerCase();
    this.headers.set(
      'content-type',
      (CONTENT_TYPE_MAP as any)[extension] ?? 'application/octet-stream',
    );
  }

  clone(): FileResponse {
    const response = new FileResponse(this.filePath);
    response.exists = this.exists;
    response.status = this.status;
    response.statusText = this.statusText;
    response.headers = new Headers(this.headers);
    return response;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return fs.promises
      .readFile(this.filePath)
      .then((buffer) => buffer.buffer as ArrayBuffer);
  }

  async blob(): Promise<Blob> {
    return new Blob([await this.arrayBuffer()], {
      type: this.headers.get('content-type')!,
    });
  }

  async text(): Promise<string> {
    return decoder.decode(await this.arrayBuffer());
  }

  async json(): Promise<object> {
    return JSON.parse(await this.text());
  }
}
