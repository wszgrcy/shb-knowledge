import { PassCode } from '@cyia/mdict-reader';

export interface AbstractDictParse {
  parse(
    filePath: string,
    options?: Partial<PassCode>,
  ): Promise<DictParseResult>;
}

export interface WordItem {
  word: string;
  content: string;
  extra?: Record<string, any>;
  htmlContent?: string;
}
export interface DictParseResult {
  info: {
    name: string;
    fileName: string | null;
    [name: string]: any;
  };

  dataListGenerator: () => AsyncGenerator<WordItem>;
  afterSave?: (assetPath: string) => Promise<void>;
}
export type DictInput = {
  filePath: string;
  /** todo 可以加yaml */
  type: 'stardict' | 'mdict' | 'yaml' | 'dsl';
  // chunkSize: number;
} & Partial<PassCode>;
