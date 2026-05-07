import { lexer } from 'marked';
import MS from 'magic-string';
type Position = [number, number, number, number];
const regex =
  /<!--\s*(Image|Table)\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*-->/dg;

//帮我实现一个js正则表达式,能够匹配文档中`<!-- Image (142, 98, 837, 856) -->`这段注释
export async function vlMarkdownParser(
  content: string,
  options: {
    imageGet: (
      type: string,
      position: Position,
    ) => Promise<{ src: string; title: string }>;
  },
) {
  let mdContent = getMdLexer(content);
  let result = mdContent.matchAll(regex);
  let ms = new MS(mdContent);
  for (const item of result) {
    // qwen3 vl
    let imageData = await options.imageGet('qwen3-vl', [
      +item[2],
      +item[3],
      +item[4],
      +item[5],
    ]);
    ms.update(
      item.index,
      item.index + item[0].length,
      `![${imageData.title}](${imageData.src})`,
    );
  }
  return ms.toString();
}
function getMdLexer(content: string) {
  const list = lexer(content);
  if (
    list.length === 1 &&
    list[0].type === 'code' &&
    (list[0].lang === 'markdown' || !list[0].lang)
  ) {
    return list[0].text as string;
  }
  return content;
}
