import { queueAsPromised } from 'fastq';
/** 实现类似chunk 调用 */
export class CacheQueue<Data> {
  #list: Data[] = [];
  constructor(
    public queue: queueAsPromised<Data[], any>,
    public count: number,
  ) {}
  push(data: Data) {
    this.#list.push(data);
    if (this.count === this.#list.length) {
      this.queue.push(this.#list);
      this.#list = [];
      return;
    }
  }
  complete() {
    if (this.#list.length) {
      this.queue.push(this.#list);
      this.#list = [];
    }
  }
}
