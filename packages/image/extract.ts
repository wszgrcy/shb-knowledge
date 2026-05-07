import sharp from 'sharp';
import { getImageMetadata } from './image-metadata';
export async function imageExtract(
  buffer: Buffer,
  position: sharp.Region,
  padding: number = 0,
) {
  let metadata =await getImageMetadata(buffer);
  let left = Math.min(
    Math.max(Math.round(position.left - padding), 0),
    metadata.width,
  );
  let top = Math.min(
    Math.max(Math.round(position.top - padding), 0),
    metadata.height,
  );
  return sharp(buffer)
    .extract({
      left,
      top,
      width: Math.min(
        Math.max(Math.round(position.width + padding * 2), 0),
        metadata.width - left,
      ),
      height: Math.min(
        Math.max(Math.round(position.height + padding * 2), 0),
        metadata.height - top,
      ),
    })
    .toBuffer();
}
