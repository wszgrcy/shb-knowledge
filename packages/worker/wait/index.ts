import { MessagePort } from 'worker_threads';
import { waitWorker } from '../wait-worker';
// todo 没用
export default (input: { port: MessagePort; buffer: SharedArrayBuffer }) =>
  waitWorker({
    buffer: input.buffer,
    index: 0,
    waitStatus: 1,
    completeStatus: 2,
    timeout: 4000,
    callback: () =>
      //   input.port.postMessage('主请求');
      new Promise((res) => {
        setTimeout(() => {
          res(1);
        }, 0);
      }),
    waitCallback: async () =>
      //   input.port.postMessage('等待请求');
      2,
  });
