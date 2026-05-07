import { InjectionToken, Signal } from 'static-injector';
import * as v from 'valibot';
export const QdrantOptionsDefine = v.object({
  host: v.optional(v.string(), '127.0.0.1'),
  port: v.optional(v.number(), 6333),
  dir: v.optional(v.string()),
  configPath: v.optional(v.string()),
  version: v.optional(v.string(), 'v1.15.4'),
});
export type QdrantOptionsType = v.InferOutput<typeof QdrantOptionsDefine> & {
  dir: string;
};
export const QdrantOptionsToken = new InjectionToken<Signal<QdrantOptionsType>>(
  'QdrantOptionsToken',
);

export const QdrantStartToken = new InjectionToken<{
  promise: Promise<void>;
  resolve: (value: void | PromiseLike<void>) => void;
  reject: (reason?: any) => void;
}>('QdrantStart');
