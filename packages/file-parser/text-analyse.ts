import { analyse, Match } from 'chardet';
function resultWeight(item: Match) {
  let offset = 0;
  if (item.lang === 'zh') {
    offset++;
    if (item.name === 'GB18030') {
      offset += 2;
    } else if (item.name === 'Big5') {
      offset++;
    }
  }
  return item.confidence + offset;
}

export function textAnalyse(buffer: Uint8Array) {
  return analyse(buffer).sort((a, b) => resultWeight(b) - resultWeight(a))[0]
    .name;
}
