import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  currentVersion,
  isVersionNewer,
} from '../src/services/versionCheckService.js';

test('版本检查使用项目根 package.json 作为当前版本', () => {
  const rootPackage = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version: string };

  assert.equal(currentVersion, rootPackage.version);
});

test('版本比较支持 v 前缀并只提醒更高版本', () => {
  assert.equal(isVersionNewer('v0.2.0', '0.1.0'), true);
  assert.equal(isVersionNewer('0.1.1', '0.1.0'), true);
  assert.equal(isVersionNewer('0.1.0', '0.1.0'), false);
  assert.equal(isVersionNewer('0.0.9', '0.1.0'), false);
  assert.equal(isVersionNewer('latest', '0.1.0'), false);
});
