import sharp from 'sharp';

export function getImageMetadata(buffer: Buffer) {
  let instance = sharp(buffer);
  return instance.metadata();
}
