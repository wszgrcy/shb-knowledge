import { InjectionToken } from 'static-injector';

export const LogToken = new InjectionToken<{
  info: (...args: any) => void;
  warn: (...args: any) => void;
  error: (...args: any) => void;
}>('Log');
