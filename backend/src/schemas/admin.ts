import { z } from 'zod';

export const adminPasswordSchema = z
  .string()
  .min(8, '管理员密码至少需要 8 位')
  .max(128, '管理员密码不能超过 128 位')
  .regex(/[A-Za-z]/, '管理员密码必须包含至少一个字母')
  .regex(/[0-9]/, '管理员密码必须包含至少一个数字');

export const adminLoginSchema = z
  .object({
    username: z.string().trim().min(1).max(32),
    password: z.string().min(1).max(128),
  })
  .strict();

export const updateAdminApplicationSchema = z
  .object({
    qqNumber: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{4,11}$/, 'QQ 号格式不正确'),
    minecraftId: z
      .string()
      .trim()
      .regex(
        /^[A-Za-z0-9_]{3,16}$/,
        'Minecraft ID 只能包含英文、数字和下划线，长度为 3 至 16 位',
      ),
  })
  .strict();

export type UpdateAdminApplicationBody = z.infer<
  typeof updateAdminApplicationSchema
>;
