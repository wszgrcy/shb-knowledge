import hbs from 'handlebars';

export function interpolate(input: string, value: Record<string, any>) {
  return hbs.compile(input, { noEscape: true, preventIndent: true })(value, {
    allowProtoPropertiesByDefault: true,
  });
}
/** 词条格式化 */
export function entryFormat(
  payload: Record<string, any>,
  knowledge: string,
  defaultContent: string,
  embedingTemplate?: {
    value?: string;
    enable: boolean;
  },
) {
  return embedingTemplate?.enable && embedingTemplate?.value
    ? interpolate(embedingTemplate.value, {
        ENTRY: { ...payload, knowledge },
      }).trim()
    : defaultContent;
}
