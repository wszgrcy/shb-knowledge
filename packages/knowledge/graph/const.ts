import { InjectionToken } from 'static-injector';
import { EntityExtractType } from './define/define';
import { FileChunkPayload } from '../common/define/chunk';
export type ContentParserFn = {
  parse: (
    item: FileChunkPayload,
    signal?: AbortSignal,
  ) => Promise<EntityExtractType>;
};
export const ContentParserToken = new InjectionToken<ContentParserFn>(
  'ContentParser',
);

export interface QueryParams {
  lengthLimit: {
    chunk: number;
    node: number;
    nodeDescription: number;
    edge: number;
  };
  topK: number;
}
export const QueryParamsToken = new InjectionToken<QueryParams>('QueryParams');
export type RagChatFn = (data: Record<string, any>) => Promise<string>;

export const RagChatToken = new InjectionToken<RagChatFn>('RagChat');
export const CHAT_INPUT = `$$INPUT$$`;
