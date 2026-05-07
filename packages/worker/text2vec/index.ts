import { pipeline } from '@huggingface/transformers';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';

import { InitOptions, setTransformersConfig } from '../set-transformers-config';
function qwen3ToVec(
  extractor: FeatureExtractionPipeline,
  query: string[],
  description = 'Given a web search query, retrieve relevant passages that answer the query',
) {
  return extractor!(
    query.map((item) => `Instruct: ${description}\nQuery:${item}`),
    {
      pooling: 'last_token',
      normalize: true,
    },
  );
}

class Text2VecService {
  #extractor!: FeatureExtractionPipeline | undefined;
  constructor() {}
  init = async (options: InitOptions) => {
    if (this.#extractor) {
      return true;
    }
    this.#extractor = await this.#downloadOnly(options);
    return !!this.#extractor;
  };
  convert = async (
    input: {
      value: string | string[];
      mode?: 'qwen3';
      taskDescription?: string;
    } & InitOptions,
  ) => {
    if (!this.#extractor) {
      await this.init(input);
    }
    const inputList =
      typeof input.value === 'string' ? [input.value] : input.value;
    let result;
    if (input.mode === 'qwen3') {
      result = qwen3ToVec(this.#extractor!, inputList, input.taskDescription);
    } else {
      result = this.#extractor!(inputList, {
        pooling: 'mean',
        normalize: true,
      });
    }
    return result.then((result) => {
      const list = result.tolist();
      return typeof input.value === 'string' ? list[0] : list;
    });
  };
  async #downloadOnly(options: InitOptions) {
    setTransformersConfig(options);

    return await pipeline(
      'feature-extraction',
      options.modelName,
      options.options,
    );
  }
  getSize = () => (this.#extractor!.model.config as any).hidden_size;
}
const instance = new Text2VecService();
const init = instance.init;
const getSize = instance.getSize;
const convert = instance.convert;
export { init, getSize, convert };
