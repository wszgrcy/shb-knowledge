import * as esbuild from 'esbuild';
import * as path from 'path';
import glob from 'fast-glob';
import { dependencies } from '../package.json';
async function main() {
  delete (dependencies as any)['xlsx'];
  let excludeList = Object.keys(dependencies);
  let options: esbuild.BuildOptions = {
    platform: 'node',
    sourcemap: 'linked',
    bundle: true,
    entryPoints: [
      ...glob.sync('./packages/**/*.spec.ts', {}).map((item) => {
        return { in: item, out: path.join('', item.slice(0, -3)) };
      }),
      // worker
      { in: 'packages/worker/text2vec/index.ts', out: './worker/text2vec' },
      { in: 'packages/worker/ocr/index.ts', out: './worker/ocr' },
      { in: 'packages/worker/wait/index.ts', out: './worker/wait' },
      { in: 'packages/worker/reranker/index.ts', out: './worker/reranker' },
    ],
    splitting: false,
    outdir: path.join(process.cwd(), './test-dist'),
    outExtension: {
      '.js': '.mjs',
    },
    format: 'esm',
    // minify: true,
    tsconfig: 'tsconfig.spec.json',
    charset: 'utf8',
    // packages: 'external',
    inject: [path.join(__dirname, './cjs-shim.ts')],
    conditions: ['import', 'module', 'node', 'commonjs', 'require', 'default'],
    mainFields: ['module', 'main'],
    external: [
      ...excludeList,
      'onnxruntime-common',
      '@huggingface/jinja',
      '@huggingface/transformers',
      '@langchain/textsplitters',
    ],
  };
  await esbuild.build(options);
}
main();
