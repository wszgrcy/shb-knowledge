import {
  GraphCollectionInlineType,
  GraphCollectionInput,
  GraphKnowledgeConfig,
} from './graph/define/config';
import {
  NormalCollectionInlineType,
  NormalCollectionInput,
  NormalKnowledgeConfig,
} from './normal/define/config';
import {
  DictCollectionInlineType,
  DictCollectionInput,
  DictKnowledgeConfig,
} from './dict/define/config';
import * as v from 'valibot';
import { KnowledgeConfigDefine } from './define';
import { ArticleKnowledgeConfig } from './article';
export type KnowledgeConfigInput =
  | NormalKnowledgeConfig
  | GraphKnowledgeConfig
  | DictKnowledgeConfig
  | ArticleKnowledgeConfig;
export type KnowledgeConfig = v.InferOutput<typeof KnowledgeConfigDefine>;
export type TextSplitter = (
  content: string,
  metadata: Record<string, any>,
  collectionName: string,
) => Promise<
  {
    pageContent: string;
    metadata: Record<string, any>;
  }[]
>;

export type OCR = (data: string) => Promise<string>;
export type Text2Vec = <T extends string | string[]>(
  value: T,
  /** 集合名字 */ collectionName: string,
) => Promise<T extends string ? number[] : number[][]>;
export type Log = {
  info: (...args: any) => void;
  warn: (...args: any) => void;
  error: (...args: any) => void;
};

export type KnowledgeCollection =
  | NormalCollectionInlineType
  | DictCollectionInlineType
  | GraphCollectionInlineType;
export type KnowledgeCollectionInput =
  | NormalCollectionInput
  | DictCollectionInput
  | GraphCollectionInput;

export type ImportList = {
  collection: string;
  checksum?: string | null;
  filePath: string;
}[];
export type KnowledgeType = NonNullable<KnowledgeConfigInput['type']>;
