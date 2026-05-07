import { expect } from 'chai';
import { dslFormat } from '../dict/dict-format/dsl/dsl.format';

describe('dsl格式化', () => {
  it('解析基础', () => {
    const list = ['*', 'trn', 'ex', 'com', '!trs', 'p', "'", 'lang'];
    for (let index = 0; index < list.length; index++) {
      const tag = list[index];
      const text = `[${tag}]a[/${tag}]`;
      const result = dslFormat(text);
      expect(result).eq(`<span>a</span>`);
    }
  });
  it('颜色', () => {
    let text = `[c]a[/c]`;
    let result = dslFormat(text);
    expect(result).eq(`a`);
    text = `[c green]a[/c]`;
    result = dslFormat(text);
    expect(result).eq(`<span style="color: green">a</span>`);
  });
  it('颜色交叉', () => {
    const text = `[c green][i]a[/c]b[/i]`;
    const result = dslFormat(text);
    expect(result).eq(
      `<span style="font-style: italic;color: green">a</span><span style="font-style: italic">b</span>`,
    );
  });
  it('url', () => {
    const text = `[url]http://a.b.c[/url]`;
    const result = dslFormat(text);
    expect(result).eq(`<a href="http://a.b.c">http://a.b.c</a>`);
  });
  it('s图片', () => {
    const text = `[s]a.bmp[/s]`;
    const result = dslFormat(text);
    expect(result).eq(
      `<picture><source srcset="a.bmp"><source srcset="a.webp"><source srcset="a.jpg"><img src="a.bmp"></picture>`,
    );
  });
  it('s音频', () => {
    const text = `[s]a.wav[/s]`;
    const result = dslFormat(text);
    expect(result).eq(`<figure><audio controls src="a.wav"></audio></figure>`);
  });
  it('s视频', () => {
    const text = `[s]a.avi[/s]`;
    const result = dslFormat(text);
    expect(result).eq(
      `<video controls style="width:100%"><source src="a.avi"/><source src="a.mp4"/><source src="a.webm"/></video>`,
    );
  });
  it('上下标', () => {
    const list = ['sub', 'sup'];
    for (const item of list) {
      const result = dslFormat(`[${item}]a[/${item}]`);
      expect(result).eq(`<${item}>a</${item}>`);
    }
  });
  it('b/u/i', () => {
    const list = [
      { tag: 'b', result: '<span style="font-weight: bolder">a</span>' },
      {
        tag: 'u',
        result: '<span style="text-decoration: #f00 wavy underline">a</span>',
      },
      { tag: 'i', result: '<span style="font-style: italic">a</span>' },
    ];
    for (const item of list) {
      const result = dslFormat(`[${item.tag}]a[/${item.tag}]`);
      expect(result).eq(item.result);
    }
  });
  it('内联交叉', () => {
    const text = `[u][i][b]a[/b]b[/i]c[/u]`;
    const result = dslFormat(text);
    expect(result).eq(
      '<span style="font-weight: bolder;font-style: italic;text-decoration: #f00 wavy underline">a</span><span style="font-style: italic;text-decoration: #f00 wavy underline">b</span><span style="text-decoration: #f00 wavy underline">c</span>',
    );
  });
  it('行包裹', () => {
    const text = `[p][u]aaa[/u][i]bbb[/i][/p]`;
    const result = dslFormat(text);
    expect(result).eq(
      '<span><span style="text-decoration: #f00 wavy underline">aaa</span><span style="font-style: italic">bbb</span></span>',
    );
  });
});
