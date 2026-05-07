import { FileChunkPayload } from '../common/define/chunk';
import { EdgeQueryPayload, NodeQueryPayload } from './define';

export interface QueryContext {
  nodes: NodeQueryPayload[];
  edges: EdgeQueryPayload[];
  chunks: FileChunkPayload[];
}

export type GraphSplitNodeInput = { node: string; list: string[] };
