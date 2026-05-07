import { QdrantClient } from '@qdrant/qdrant-js';

export interface QueryOptions {
  limit?: number;
  score?: number;
  offset?: number;
}
export type FilterOptions = Parameters<QdrantClient['search']>[1]['filter'];
