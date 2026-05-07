import * as v from 'valibot';
import { NormalKnowledgeConfigDefine } from '../normal/define/config';
import { DictKnowledgeConfigDefine } from '../dict/define/config';
import { GraphKnowledgeConfigDefine } from '../graph/define/config';
import { ArticleKnowledgeConfigDefine } from '../article';
export const KnowledgeConfigDefine = v.union([
  NormalKnowledgeConfigDefine,
  DictKnowledgeConfigDefine,
  GraphKnowledgeConfigDefine,
  ArticleKnowledgeConfigDefine,
]);
