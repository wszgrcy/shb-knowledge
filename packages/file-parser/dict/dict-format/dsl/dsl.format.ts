const blockStatusList = [
  '*',
  'm',
  'trn',
  'ex',
  'com',
  's',
  'url',
  '!trs',
  'p',
  "'",
  'lang',
  'ref',
  'sub',
  'sup',
];
const inlineStatusList = ['b', 'i', 'u', 'c'];
const sImageList = ['bmp', 'pcx', 'dcx', 'jpg', 'tif'];
const sSoundList = ['wav'];
const sVideoList = ['avi', 'webm', 'mp4'];
class NodeItem {
  start!: number;
  // attr: Record<string, any> = {};
  type!: 'inline' | 'block' | 'text';
}
class InlineNode extends NodeItem {
  override type = 'inline' as const;
  attr;
  tag;
  constructor(tag: string, attr: Record<string, any>) {
    super();
    this.attr = attr;
    this.tag = tag;
  }
}
class BlockNode extends NodeItem {
  override type = 'block' as const;
  fn;
  tag;
  constructor(tag: string, fn: (text: string) => string) {
    super();
    this.tag = tag;
    this.fn = fn;
  }
}
class TextNode extends NodeItem {
  override type = 'text' as const;
  text: string;
  style: Record<string, any> = {};
  constructor(text: string) {
    super();
    this.text = text;
  }
  renderedText!: string;
  renderText() {
    const styleAttr = Object.entries(this.style)
      .map((item) => `${item[0]}: ${item[1]}`)
      .join(';');
    const formatedText = this.text.replace(/\\\[/g, '[').replace(/\\]/g, ']');
    if (styleAttr.trim().length) {
      this.renderedText = `<span style="${styleAttr}">${formatedText}</span>`;
    } else {
      this.renderedText = `${formatedText}`;
    }
  }
}
class DslFormat {
  #inlineStatus: InlineNode[] = [];
  #blockStatus: BlockNode[] = [];
  #textNodeList: TextNode[] = [];
  #input;
  #start = 0;
  constructor(input: string) {
    this.#input = input;
  }
  run() {
    if (!this.#input) {
      return this.#input;
    }
    this.#scan();
    return this.#textNodeList.map((item) => item.renderedText).join('');
  }
  #scan() {
    let startResult: RegExpExecArray | null;
    let endResult: RegExpExecArray | null;
    const startRegexp =
      /(?<!\\)\[(?!\/)(?<tagName>m(?<leftPadding>[0-9])|[^\]\s]+)((\s+)(?<attr>[^\]]+))?]/dg;
    const endRegexp = /(?<!\\)\[\/(?<tagName>[^\]]+)]/dg;

    while (true) {
      startRegexp.lastIndex = this.#start;
      endRegexp.lastIndex = this.#start;
      const currentText = this.#input;
      startResult = startRegexp.exec(currentText);
      endResult = endRegexp.exec(currentText);

      if (
        startResult &&
        (!endResult || startResult.indices![0][0] < endResult.indices![0][0])
      ) {
        // 匹配开始
        const tagName = startResult.groups!['tagName'];
        const matchStart = startResult.indices![0][0];
        this.#createTextNode(this.#start, matchStart);

        this.#createStatusNode(
          tagName.startsWith('m') ? 'm' : tagName,
          matchStart,
          startResult.groups!['leftPadding'] || startResult.groups!['attr'],
        );
        this.#start = startResult.indices![0][1];
      } else {
        if (endResult) {
          const tagName = endResult.groups!['tagName'];
          const matchStart = endResult.indices![0][0];
          this.#createTextNode(this.#start, matchStart);

          this.#mergeTextNode(tagName, matchStart);
          this.#removeStatus(tagName);
          this.#start = endResult.indices![0][1];
        } else {
          break;
        }
      }
    }
  }
  /** 普通的文本节点创建 */
  #createTextNode(start: number, end: number) {
    if (start < end) {
      const node = new TextNode(this.#input.slice(start, end));
      node.start = start;
      node.style = this.#inlineStatus.reduce(
        (obj, item) => ({ ...obj, ...item.attr }),
        {} as Record<string, any>,
      );
      node.renderText();
      this.#textNodeList.push(node);

      return node;
    }
  }
  #createStatusNode(name: string, start: number, attrStr: string) {
    if (inlineStatusList.includes(name)) {
      attrStr;
      let attr = {} as Record<string, any>;
      switch (name) {
        case 'c':
          if (attrStr) {
            attr = { color: attrStr };
          }
          break;
        case 'b':
          attr = { 'font-weight': 'bolder' };
          break;
        case 'u':
          attr = { 'text-decoration': '#f00 wavy underline' };
          break;
        case 'i':
          attr = { 'font-style': 'italic' };
          break;
      }

      const node = new InlineNode(name, attr);
      node.start = start;
      this.#inlineStatus.unshift(node);
    } else {
      const node = new BlockNode(name, (text) => {
        switch (name) {
          case 'm': {
            return `<div style="padding-left: ${attrStr}em;">${text}</div>`;
          }
          case 'url': {
            return `<a href="${text}">${text}</a>`;
          }
          case 'ref': {
            return `<a href="entry://${text}">${text}</a>`;
          }
          case 'sub':
          case 'sup': {
            {
              return `<${name}>${text}</${name}>`;
            }
          }
          case 's': {
            if (sImageList.some((item) => text.endsWith(item))) {
              const baseName = text.slice(0, text.lastIndexOf('.'));
              return `<picture><source srcset="${text}"><source srcset="${baseName}.webp"><source srcset="${baseName}.jpg"><img src="${text}"></picture>`;
            } else if (sSoundList.some((item) => text.endsWith(item))) {
              return `<figure><audio controls src="${text}"></audio></figure>`;
            } else if (sVideoList.some((item) => text.endsWith(item))) {
              const baseName = text.slice(0, text.lastIndexOf('.'));
              return `<video controls style="width:100%"><source src="${text}"/><source src="${baseName}.mp4"/><source src="${baseName}.webm"/></video>`;
            }
            return ``;
          }
          default: {
            return `<span>${text}</span>`;
          }
        }
      });
      node.start = start;
      this.#blockStatus.unshift(node);
    }
  }
  #mergeTextNode(name: string, end: number) {
    const blockStart = this.#blockStatus.find((item) => item.tag === name);
    if (blockStart) {
      const start = blockStart.start;
      let tempIndex = -1;

      // let i = this.textNodeList.length - 1;
      for (let i = this.#textNodeList.length - 1; i > -1; i--) {
        const textNode = this.#textNodeList[i];
        if (textNode.start < start) {
          break;
        } else {
          tempIndex = i;
        }
      }
      if (tempIndex !== -1) {
        const delNodeList = this.#textNodeList.slice(tempIndex);

        const mergeText = blockStart.fn(
          delNodeList.map((item) => item.renderedText).join(''),
        );

        this.#textNodeList = this.#textNodeList.slice(0, tempIndex);
        const node = new TextNode(mergeText);
        node.start = start;
        node.renderedText = node.text;
        this.#textNodeList.push(node);
      }
    }
  }
  #removeStatus(name: string) {
    if (inlineStatusList.includes(name)) {
      const index = this.#inlineStatus.findIndex((item) => item.tag === name);
      this.#inlineStatus.splice(index, 1);
    } else {
      const index = this.#blockStatus.findIndex((item) => item.tag === name);
      this.#blockStatus.splice(index, 1);
    }
  }
}

export function dslFormat(input: string) {
  const item = new DslFormat(input);
  return item.run();
}
