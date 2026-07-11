import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isVersionNewer } from '../src/services/versionCheckService.js';

test('版本比较支持 v 前缀并只提醒更高版本', () => {
  assert.equal(isVersionNewer('v0.2.0', '0.1.0'), true);
  assert.equal(isVersionNewer('0.1.1', '0.1.0'), true);
  assert.equal(isVersionNewer('0.1.0', '0.1.0'), false);
  assert.equal(isVersionNewer('0.0.9', '0.1.0'), false);
  assert.equal(isVersionNewer('latest', '0.1.0'), false);
});
