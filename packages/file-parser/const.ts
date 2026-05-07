import { FileTypeResult } from 'file-type';
import { InjectionToken, Signal } from 'static-injector';
import { FormatedData } from './document-file-parser.service';

export interface FileParser {
  priority: number;
  parse: (
    fileName: string,
    buffer: Uint8Array | ArrayBuffer,
    type: FileTypeResult | undefined,
  ) => Promise<FormatedData[] | undefined>;
}
export const FileParserToken = new InjectionToken<FileParser[]>('FileParser');
export const ImageParserToken = new InjectionToken<
  (
    assetPath: string,
    prefix: string,
    buffer: Buffer<ArrayBufferLike>,
  ) => Promise<{
    content: string;
    parseTo: string;
    // assets: any[];
  }>
>('ImageParserToken');
export const DocumentParserConfigToken = new InjectionToken<
  Signal<{
    pdfAsImage?: {
      enable?: boolean;
      viewPortOptions?: {
        scale?: number;
      };
    };
  }>
>('DocumentParserConfigToken');
