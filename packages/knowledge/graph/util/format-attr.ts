import * as v from 'valibot';
import {
  EdgePayloadDefine,
  GraphNodeAttr,
  NodePayloadDefine,
} from '../define/define';
import { countBy, maxBy } from 'lodash-es';

export function getNodeType(list: GraphNodeAttr['list']) {
  const data = countBy(list, (item) => item.type);
  delete data['未知'];
  return maxBy(Object.entries(data), (a) => a[1])?.[0] ?? '未知';
}

export function formatNodeAttr2(list: { data: any; score: number }[]) {
  let allCount = 0;
  const attrList = list.map(({ data, score }) => {
    allCount += score;
    return v.parse(NodePayloadDefine, data);
  });
  const score = allCount / list.length;
  const data = countBy(attrList, (item) => item.type);
  delete data['未知'];
  const type = getNodeType(attrList);
  attrList.forEach((item) => {
    item.type = type;
  });
  return {
    list: attrList,
    name: attrList[0].name,
    type: getNodeType(attrList),
    degree: score,
  };
}

export type FormatGraphNodeAttr = ReturnType<typeof formatNodeAttr2>;
export type QueryGraphNodeAttr = FormatGraphNodeAttr & { degree: number };

export function formatEdgeAttr2(list: { data: any; score: number }[]) {
  let allCount = 0;

  const attrList = list.map(({ data, score }) => {
    allCount += score;

    return v.parse(EdgePayloadDefine, data);
  });
  const score = allCount / list.length;

  return {
    list: attrList,
    name: attrList[0].name,
    source: attrList[0].source,
    target: attrList[0].target,
    degree: score,
  };
}
export type FormatGraphEdgeAttr = ReturnType<typeof formatEdgeAttr2>;
export type QueryGraphEdgeAttr = FormatGraphEdgeAttr & { degree: number };
