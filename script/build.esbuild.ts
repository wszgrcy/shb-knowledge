import * as esbuild from 'esbuild';
import * as path from 'path';
import { copy } from 'esbuild-plugin-copy';

// 发布之前构建
async function main() {
  let options: esbuild.BuildOptions = {
    platform: 'node',
    bundle: true,
    sourcemap: true,
    entryPoints: [
      ...[
        'embedding',
        'file-parser',
        'knowledge',
        'qdrant',
        'util',
        'image',
        'ocr',
      ].map((item) => ({
        in: `./packages/${item}/index.ts`,
        out: `./${item}`,
      })),
      { in: 'packages/worker/text2vec/index.ts', out: './worker/text2vec' },
      { in: 'packages/worker/ocr/index.ts', out: './worker/ocr' },
      { in: 'packages/worker/reranker/index.ts', out: './worker/reranker' },
    ],

    charset: 'utf8',
    splitting: false,
    outdir: path.join(process.cwd(), '/dist'),
    format: 'esm',
    keepNames: false,
    outExtension: {
      '.js': '.mjs',
    },
    // minify: true,
    tsconfig: 'tsconfig.build.json',
    packages: 'external',
    external: ['@shenghuabi/knowledge/*'],
    plugins: [
      copy({
        resolveFrom: 'cwd',
        once: true,
        assets: [{ from: `./assets/*`, to: './dist' }],
      }),
    ],
  };
  await esbuild.build(options);
}
main();
