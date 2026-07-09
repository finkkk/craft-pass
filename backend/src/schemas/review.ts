import { z } from 'zod';

export const rejectApplicationSchema = z
  .object({
    reason: z.string().trim().min(1, '请填写拒绝原因').max(500),
  })
  .strict();
