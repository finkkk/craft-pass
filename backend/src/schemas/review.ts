import { z } from 'zod';

export const rejectApplicationSchema = z
  .object({
    reason: z.string().trim().max(500).default(''),
  })
  .strict();

export const batchReviewSchema = z
  .object({
    action: z.enum(['approve', 'reject', 'retry']),
    applicationIds: z
      .array(z.string().min(1).max(64))
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, '申请记录不能重复'),
    reason: z.string().trim().max(500).default(''),
  })
  .strict();
