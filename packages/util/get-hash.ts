import { createHash } from 'node:crypto';
import { v5 } from 'uuid';
// 用于id生成,修复直接用md5生成的hash没有`-`
export const UUID_NS = '4c394ecc-764e-46ea-a770-f21a7c10aee1';

export function getHash(content: string) {
  return v5(createHash('md5').update(content).digest('hex'), UUID_NS);
}
