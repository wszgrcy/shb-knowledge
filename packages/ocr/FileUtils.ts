import fs from 'node:fs/promises';
import { FileUtilsBase } from '@gutenye/ocr-common';
import { path } from '@cyia/vfs2';
export class FileUtils extends FileUtilsBase {
  static override async read(filePath: string) {
    return await fs.readFile(path.normalize(filePath), 'utf8');
  }
}
