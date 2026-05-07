import { QueryGraphEdgeAttr, QueryGraphNodeAttr } from './format-attr';

/** 用来计算权重 */
export function sigmoid(z: number) {
  return 1 / (1 + Math.exp(-z));
}

export function getNodeStrList(item: QueryGraphNodeAttr, index: number) {
  return [
    index + 1,
    item.name,
    item.type,
    item.list.map((item) => item.description).join(';'),
    (item.degree * 100).toFixed(0),
  ];
}
export function getEdgeStrList(item: QueryGraphEdgeAttr, i: number) {
  return [
    i + 1,
    item.source,
    item.target,
    item.list.map((item) => item.description).join(';'),
    (item.degree * 100).toFixed(0),
  ];
}
