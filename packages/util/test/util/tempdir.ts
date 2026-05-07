import * as fs from 'fs/promises';
import { path } from '@cyia/vfs2';
import { v4 } from 'uuid';
export async function getTempDir() {
  const dir = path.join(process.cwd(), '.tmp', `knowledge-${v4()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
