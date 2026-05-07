import { FileTypeResult } from 'file-type';
import { inject, Injector, RootStaticInjectOptions } from 'static-injector';
import { EPubLoader } from '@langchain/community/document_loaders/fs/epub';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { PPTXLoader } from '@langchain/community/document_loaders/fs/pptx';
import { SRTLoader } from '@langchain/community/document_loaders/fs/srt';
import type { Document } from '@langchain/core/documents';
import { Blob } from 'node:buffer';
import { path } from '@cyia/vfs2';
import { xlsxLoader } from './document-loader/xlsx.loader';
import { DocumentParserConfigToken } from './const';
import { pdfImageLoader } from './document-loader/pdf-img.loader';
export type ParsedData = Document<Record<string, any>> & { parseTo?: string };
export type FormatedData = {
  title: any;
  content: string;
  parseTo?: string;
}
export class DocumentFileParserService extends RootStaticInjectOptions {
  #documentParser = inject(DocumentParserConfigToken, { optional: true });
  #injector = inject(Injector);

  async parse(
    filePath: string,
    buffer: Uint8Array | ArrayBuffer,
    type: FileTypeResult | undefined,
  ): Promise<FormatedData[] | undefined> {
    try {
      const baseName = path.basename(filePath, path.extname(filePath));
      const blob = new Blob([buffer]);
      if (filePath.endsWith('.srt')) {
        const instance = new SRTLoader(blob);
        const result = await instance.load();
        return this.#formatResult(result, baseName);
      } else if (
        type?.ext === 'pptx' ||
        type?.ext === 'odt' ||
        type?.ext === 'odp' ||
        type?.ext === 'ods'
      ) {
        const instance = new PPTXLoader(blob);
        const result = await instance.load();
        return this.#formatResult(result, baseName);
      } else if (type?.ext === 'pdf') {
        let result;
        const useImage = this.#documentParser?.().pdfAsImage?.enable;
        if (useImage) {
          result = await pdfImageLoader(buffer, filePath, this.#injector);
        } else {
          const instance = new PDFLoader(blob);
          result = await instance.load();
        }
        return this.#formatResult(result, baseName);
      } else if (filePath.endsWith('.csv')) {
        const instance = new CSVLoader(blob);
        const result = await instance.load();
        return this.#formatResult(result, baseName);
      } else if (type?.ext === 'docx') {
        const instance = new DocxLoader(blob);
        const result = await instance.load();
        return this.#formatResult(result, baseName);
      } else if (type?.ext === 'xlsx') {
        const result = await xlsxLoader(buffer);
        return this.#formatResult(result, baseName);
      } else if (type?.ext === 'epub') {
        const instance = new EPubLoader(filePath);
        const result = await instance.load();
        return result
          .filter((item) => !!item.pageContent)
          .map((item, i) => ({
            title: item.metadata['chapter'] || `[未命名]${i + 1}`,
            content: item.pageContent,
          }));
      } else {
        return;
      }
    } catch (error) {
      throw new Error(
        `文件:[${filePath}]解析失败;类型[${JSON.stringify(type) ?? ''}]`,
        {
          cause: error,
        },
      );
    }
  }

  #formatResult(list: ParsedData[], title: string) {
    if (list.length === 1) {
      return [
        {
          title: list[0].metadata?.['title'] ?? title,
          content: list[0].pageContent.trim(),
          parseTo: list[0].parseTo,
        },
      ];
    }
    return list
      .map((item) => ({ ...item, pageContent: item.pageContent?.trim() }))
      .filter((item) => !!item.pageContent)
      .map((item, index) => ({
        title: item.metadata?.['title'] ?? `${title}-${index}`,
        content: item.pageContent,
        parseTo: item.parseTo,
      }));
  }
}
