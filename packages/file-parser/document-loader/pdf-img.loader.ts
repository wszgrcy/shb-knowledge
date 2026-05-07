import { Injector } from 'static-injector';
import { DocumentParserConfigToken, ImageParserToken } from '../const';
import { path } from '@cyia/vfs2';
export async function pdfImageLoader(
  buffer: Uint8Array | ArrayBuffer,
  filePath: string,
  injector: Injector,
) {
  let canvas = await import('@napi-rs/canvas');
  if (!(globalThis as any).DOMMatrix) {
    (globalThis as any).DOMMatrix = canvas.DOMMatrix;
  }
  if (!(globalThis as any).ImageData) {
    (globalThis as any).ImageData = canvas.ImageData;
  }
  if (!(globalThis as any).Path2D) {
    (globalThis as any).Path2D = canvas.Path2D;
  }
  const { getDocument } = await import('pdfjs-dist');
  let pdf = await getDocument(new Uint8Array(buffer)).promise;
  let list = [];
  let metadata = await pdf.getMetadata();
  const fileName = path.basename(filePath, path.extname(filePath));
  let title = (metadata.info as any)['Title'] || fileName;
  let imageParser = injector.get(ImageParserToken);
  let documentParserConfig = injector.get(DocumentParserConfigToken);
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({
      scale: documentParserConfig().pdfAsImage?.viewPortOptions?.scale ?? 1,
    });
    const canvasEl = canvas.createCanvas(viewport.width, viewport.height);
    const ctx = canvasEl.getContext('2d');
    await page.render({
      canvasContext: ctx! as any,
      viewport,
      canvas: canvasEl as any,
    }).promise;
    const image = canvasEl.toBuffer('image/png');
    let result = await imageParser(filePath, `${fileName}-${i}`, image);
    // 图片接入工作流
    list.push({
      pageContent: result.content,
      metadata: { title: title },
      parseTo: result.parseTo,
    });
  }

  return list;
}
