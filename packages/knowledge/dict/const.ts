import { InjectionToken } from 'static-injector';

export const DictOptionsToken = new InjectionToken<{
  wordBatchCount: number;
  wordMaxAsync: number;
}>('DictOptions');
