import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApplicationStatus } from '../src/generated/prisma/enums.js';
import {
  assertApplicationStatusTransition,
  canTransitionApplicationStatus,
  InvalidApplicationStatusTransitionError,
} from '../src/domain/applicationStatus.js';

test('待审核申请可以被拒绝、加入白名单或标记为 RCON 失败', () => {
  assert.equal(
    canTransitionApplicationStatus(
      ApplicationStatus.PENDING_REVIEW,
      ApplicationStatus.REJECTED,
    ),
    true,
  );
  assert.equal(
    canTransitionApplicationStatus(
      ApplicationStatus.PENDING_REVIEW,
      ApplicationStatus.WHITELISTED,
    ),
    true,
  );
  assert.equal(
    canTransitionApplicationStatus(
      ApplicationStatus.PENDING_REVIEW,
      ApplicationStatus.RCON_FAILED,
    ),
    true,
  );
});

test('RCON 失败只能在重试成功后进入白名单状态', () => {
  assert.equal(
    canTransitionApplicationStatus(
      ApplicationStatus.RCON_FAILED,
      ApplicationStatus.WHITELISTED,
    ),
    true,
  );
  assert.equal(
    canTransitionApplicationStatus(
      ApplicationStatus.RCON_FAILED,
      ApplicationStatus.REJECTED,
    ),
    false,
  );
});

test('终态和重复状态变更会被拒绝', () => {
  assert.throws(
    () =>
      assertApplicationStatusTransition(
        ApplicationStatus.WHITELISTED,
        ApplicationStatus.PENDING_REVIEW,
      ),
    InvalidApplicationStatusTransitionError,
  );
  assert.equal(
    canTransitionApplicationStatus(
      ApplicationStatus.PENDING_REVIEW,
      ApplicationStatus.PENDING_REVIEW,
    ),
    false,
  );
});
