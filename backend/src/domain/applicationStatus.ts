import { ApplicationStatus } from '../generated/prisma/enums.js';

const allowedTransitions: Readonly<
  Record<ApplicationStatus, readonly ApplicationStatus[]>
> = {
  [ApplicationStatus.QUIZ_FAILED]: [],
  [ApplicationStatus.PENDING_REVIEW]: [
    ApplicationStatus.REJECTED,
    ApplicationStatus.WHITELISTED,
    ApplicationStatus.RCON_FAILED,
  ],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.WHITELISTED]: [],
  [ApplicationStatus.RCON_FAILED]: [ApplicationStatus.WHITELISTED],
};

const publicStatusValues = {
  [ApplicationStatus.QUIZ_FAILED]: 'quiz_failed',
  [ApplicationStatus.PENDING_REVIEW]: 'pending_review',
  [ApplicationStatus.REJECTED]: 'rejected',
  [ApplicationStatus.WHITELISTED]: 'whitelisted',
  [ApplicationStatus.RCON_FAILED]: 'rcon_failed',
} as const satisfies Record<ApplicationStatus, string>;

export function canTransitionApplicationStatus(
  from: ApplicationStatus,
  to: ApplicationStatus,
) {
  return allowedTransitions[from].includes(to);
}

export function assertApplicationStatusTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
) {
  if (!canTransitionApplicationStatus(from, to)) {
    throw new InvalidApplicationStatusTransitionError(from, to);
  }
}

export function toPublicApplicationStatus(status: ApplicationStatus) {
  return publicStatusValues[status];
}

export class InvalidApplicationStatusTransitionError extends Error {
  constructor(
    readonly from: ApplicationStatus,
    readonly to: ApplicationStatus,
  ) {
    super(`不允许将申请状态从 ${from} 变更为 ${to}`);
    this.name = 'InvalidApplicationStatusTransitionError';
  }
}
