import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
} from '@huggingface/transformers';
import type {
  Tensor,
  XLMRobertaModel,
  XLMRobertaTokenizer,
} from '@huggingface/transformers';

import { InitOptions, setTransformersConfig } from '../set-transformers-config';

class ReRanderService {
  init = async (options: InitOptions) => {
    if (!this.model || !this.tokenizer) {
      await this.#downloadOnly(options);
    }
    return true;
  };
  convert = async (input: { value: string; docs: string[] }) => {
    const inputs = this.tokenizer!(
      new Array(input.docs.length).fill(input.value),
      {
        text_pair: input.docs,
        padding: true,
        truncation: true,
      },
    );
    const { logits } = await this.model!(inputs);
    return (logits as Tensor)
      .sigmoid()
      .tolist()
      .map(([score], i: number) => ({
        index: i,
        score,
      }))
      .sort((a, b) => b.score - a.score);
  };
  tokenizer?: XLMRobertaTokenizer;
  model?: XLMRobertaModel;
  async #downloadOnly(options: InitOptions) {
    setTransformersConfig(options);

    this.tokenizer = await AutoTokenizer.from_pretrained(options.modelName);
    this.model = await AutoModelForSequenceClassification.from_pretrained(
      options.modelName,
      {
        ...options.options,
      } as any,
    );
  }
}
const instance = new ReRanderService();
const init = instance.init;
const convert = instance.convert;
export { init, convert };
