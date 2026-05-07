import { InjectionToken, Signal } from 'static-injector';
import { KnowledgeConfig, OCR, Text2Vec, TextSplitter } from './type';
export function getGraphCollectionName(name: string) {
  return `[图谱]${name}-定义`;
}
/** 进行增加删除的永远是这个 */
export function getActivateCollectionName(name: string) {
  return `${name}[激活]`;
}

export const DICT_PREFIX = '[字典]-';

export const Text2VecToken = new InjectionToken<Text2Vec>('text2vec');

// 解析结果需要自动过滤空pageContent
export const TextSplitterToken = new InjectionToken<TextSplitter>(
  'TextSplitter',
);

export const ConfigToken = new InjectionToken<Signal<KnowledgeConfig>>(
  'config',
);
export const GetConfigToken = new InjectionToken<
  (name: string) => Promise<KnowledgeConfig>
>('getConfig');

export const OCRToken = new InjectionToken<OCR>('OCR');

export const DirToken = new InjectionToken<Signal<string>>('dir');

export const ReRankerToken = new InjectionToken<{
  run: (text: {
    value: string;
    docs: string[];
  }) => Promise<{ index: number; score: any }[]>;
  getQueryRatio(): number;
}>('reranker');
