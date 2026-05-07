import * as v from 'valibot';
export const EmbeddingTemplateDefine = v.object({
  enable: v.boolean(),
  value: v.optional(v.string()),
});
