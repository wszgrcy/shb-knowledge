import path from 'path';

export function getFixtureDir() {
  return path.join(process.cwd(), './packages/knowledge/test/fixture');
}
