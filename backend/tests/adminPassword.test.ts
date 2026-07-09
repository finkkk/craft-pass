import assert from 'node:assert/strict';
import test from 'node:test';
import { adminPasswordSchema } from '../src/schemas/admin.js';

test('管理员密码只要求至少 8 位且同时包含字母和数字', () => {
  assert.equal(adminPasswordSchema.safeParse('admin123').success, true);
  assert.equal(adminPasswordSchema.safeParse('ABC12345').success, true);
  assert.equal(adminPasswordSchema.safeParse('abcdefghi').success, false);
  assert.equal(adminPasswordSchema.safeParse('12345678').success, false);
  assert.equal(adminPasswordSchema.safeParse('abc123').success, false);
});
