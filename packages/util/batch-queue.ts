import { withResolvers } from './promise';
import { promise as fastq } from 'fastq';

export class BatchQueue<INPUT, RETURN> {
  #list: INPUT[] = [];
  #fn;

  constructor(fn: (input: INPUT[]) => Promise<RETURN[]>) {
    this.#fn = fastq(
      (input: {
        list: INPUT[];
        resolve: (value: RETURN[] | PromiseLike<RETURN[]>) => void;
      }) =>
        fn(input.list).then((result) => {
          input.resolve(result);
        }),
      999999999,
    );
  }
  #p = withResolvers<RETURN[]>();

  push(value: INPUT) {
    const p = this.#p;
    const index = this.#list.length;
    this.#list.push(value);
    this.#delayEnd();
    return p.promise.then((list) => list[index]);
  }

  #complete() {
    if (this.#list.length) {
      const p = this.#p;
      this.#fn.push({ list: this.#list, resolve: p.resolve });
      this.#p = withResolvers();
      this.#list = [];
    }
  }
  then<T>(promise: Promise<T>) {
    return Promise.all([promise, this.#complete()]).then(([result]) => result);
  }
  #delayEndId: any;

  #clearDelayEnd() {
    if (typeof this.#delayEndId === 'number') {
      clearTimeout(this.#delayEndId);
      this.#delayEndId = undefined;
    }
  }
  #delayEnd() {
    this.#clearDelayEnd();
    this.#delayEndId = setTimeout(() => {
      this.#end();
    }, 20);
  }
  #end() {
    if (this.#list.length) {
      const p = this.#p;
      this.#fn.push({ list: this.#list, resolve: p.resolve });
      this.#p = withResolvers();
      this.#list = [];
    }
  }
}
