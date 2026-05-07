// 暂时放弃,无法实现一个锁,因为多线程始终要等待
export async function waitWorker(input: {
  buffer: SharedArrayBuffer;
  index: number;
  waitStatus: number;
  completeStatus: number;
  timeout: number;
  callback: () => Promise<any>;
  waitCallback?: () => Promise<any>;
}) {
  const int32 = new Int32Array(input.buffer);
  if (Atomics.load(int32, input.index) === input.waitStatus) {
    const waitResult = Atomics.wait(
      int32,
      input.index,
      input.waitStatus,
      input.timeout,
    );
    if (waitResult === 'ok') {
      return input.waitCallback?.();
    }
  } else {
    Atomics.store(int32, input.index, input.waitStatus);
    const result = await input.callback();
    Atomics.store(int32, input.index, input.completeStatus);
    Atomics.notify(int32, input.index);
    return result;
  }
}
