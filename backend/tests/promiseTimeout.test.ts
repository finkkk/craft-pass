import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OperationTimeoutError,
  withTimeout,
} from '../src/utils/promiseTimeout.js';

test('超时保护会结束永久挂起的异步操作并执行清理', async () => {
  let cleanedUp = false;
  const neverSettles = new Promise<never>(() => undefined);

  await assert.rejects(
    withTimeout(neverSettles, 20, '测试操作超时', () => {
      cleanedUp = true;
    }),
    (error: unknown) =>
      error instanceof OperationTimeoutError && error.message === '测试操作超时',
  );
  assert.equal(cleanedUp, true);
});
