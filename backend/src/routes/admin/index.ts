import { compare } from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import {
  adminSessionCookieName,
  getAdminSessionClearCookieOptions,
  getAdminSessionCookieOptions,
} from '../../config/adminSession.js';
import { toPublicApplicationStatus } from '../../domain/applicationStatus.js';
import { AdminAction } from '../../generated/prisma/enums.js';
import { requireAdmin } from '../../middleware/adminAuth.js';
import { adminLoginRateLimiter } from '../../middleware/security.js';
import { prisma } from '../../lib/prisma.js';
import {
  adminLoginSchema,
  createAdminApplicationSchema,
  updateAdminApplicationSchema,
} from '../../schemas/admin.js';
import {
  batchReviewSchema,
  rejectApplicationSchema,
} from '../../schemas/review.js';
import {
  updateLogoSchema,
  updateSettingsSchema,
} from '../../schemas/settings.js';
import {
  contentConfigSchema,
  uiContentSchema,
} from '../../schemas/content.js';
import {
  getAdminApplication,
  getAdminDashboardSummary,
  listAdminApplications,
  parsePublicApplicationStatus,
  createAdminApplication,
  updateAdminApplication,
  deleteAdminApplication,
  ApplicationRecordOperationError,
} from '../../services/adminApplicationService.js';
import {
  createAdminSession,
  deleteAdminSession,
} from '../../services/adminSessionService.js';
import {
  approveApplication,
  rejectApplication,
  retryApplicationRcon,
  ReviewOperationError,
} from '../../services/reviewService.js';
import {
  executeRconCommand,
  getRconConnectionStatus,
  RconCommandBlockedError,
  RconCustomCommandsDisabledError,
  RconNotConfiguredError,
} from '../../services/rconService.js';
import { getAdminStatistics } from '../../services/adminStatisticsService.js';
import {
  deleteSiteLogo,
  getSiteLogoStatus,
  saveSiteLogo,
  SiteLogoError,
} from '../../services/siteLogoService.js';
import { HttpError } from '../../utils/HttpError.js';
import {
  getAdminRuntimeConfig,
  updateRuntimeConfig,
} from '../../config/runtimeConfig.js';
import {
  getContentConfig,
  saveContentConfig,
} from '../../config/contentConfig.js';
import { factoryReset } from '../../services/factoryResetService.js';
import { getVersionStatus } from '../../services/versionCheckService.js';

export const adminRouter = Router();

const rconCommandSchema = z
  .object({
    command: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine((command) => !/[\r\n]/.test(command), '命令不能包含换行'),
  })
  .strict();

const factoryResetSchema = z
  .object({
    confirmation: z.literal('RESET'),
  })
  .strict();

adminRouter.post(
  '/login',
  adminLoginRateLimiter,
  async (request, response) => {
    const result = adminLoginSchema.safeParse(request.body);

    if (!result.success) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        '登录信息格式不正确',
        z.flattenError(result.error),
      );
    }

    const admin = await prisma.admin.findUnique({
      where: {
        username: result.data.username,
      },
    });
    const passwordValid =
      admin && (await compare(result.data.password, admin.passwordHash));

    if (!admin || !passwordValid) {
      throw new HttpError(
        401,
        'INVALID_ADMIN_CREDENTIALS',
        '用户名或密码不正确',
      );
    }

    const session = await createAdminSession(admin.id, {
      ipAddress: request.ip,
      userAgent: request.get('user-agent')?.slice(0, 512),
    });

    response.cookie(
      adminSessionCookieName,
      session.token,
      getAdminSessionCookieOptions(request.secure),
    );

    await prisma.adminLog.create({
      data: {
        adminId: admin.id,
        action: AdminAction.LOGIN,
        ipAddress: request.ip,
      },
    });

    response.json({
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
      expiresAt: session.expiresAt.toISOString(),
    });
  },
);

adminRouter.use(requireAdmin);

adminRouter.get('/session', (_request, response) => {
  response.json({
    admin: response.locals.admin,
  });
});

adminRouter.post('/logout', async (request, response) => {
  const token = response.locals.adminSessionToken;
  const admin = response.locals.admin;

  if (token) {
    await deleteAdminSession(token);
  }

  if (admin) {
    await prisma.adminLog.create({
      data: {
        adminId: admin.id,
        action: AdminAction.LOGOUT,
      },
    });
  }

  response.clearCookie(
    adminSessionCookieName,
    getAdminSessionClearCookieOptions(request.secure),
  );
  response.status(204).end();
});

adminRouter.get('/summary', async (_request, response) => {
  response.json(await getAdminDashboardSummary());
});

adminRouter.get('/statistics', async (_request, response) => {
  response.json(await getAdminStatistics());
});

adminRouter.get('/content', (_request, response) => {
  response.json({ content: getContentConfig() });
});

adminRouter.put('/content', async (request, response) => {
  const result = contentConfigSchema.safeParse(request.body);

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '服规或题库格式不正确',
      z.flattenError(result.error),
    );
  }

  const previous = getContentConfig();
  const content = saveContentConfig(result.data);

  await prisma.adminLog.create({
    data: {
      adminId: response.locals.admin!.id,
      action: AdminAction.UPDATE_CONTENT,
      ipAddress: request.ip,
      detail: {
        previousAgreementVersion: previous.agreement.version,
        agreementVersion: content.agreement.version,
        previousQuestionCount: previous.quiz.questions.length,
        questionCount: content.quiz.questions.length,
      },
    },
  });

  response.json({ content });
});

adminRouter.put('/content/rules-quiz', async (request, response) => {
  const current = getContentConfig();
  const result = contentConfigSchema.safeParse({
    ui: current.ui,
    agreement: request.body?.agreement,
    quiz: request.body?.quiz,
  });

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '服规或题库格式不正确',
      z.flattenError(result.error),
    );
  }

  const content = saveContentConfig({
    ...current,
    agreement: result.data.agreement,
    quiz: result.data.quiz,
  });

  await prisma.adminLog.create({
    data: {
      adminId: response.locals.admin!.id,
      action: AdminAction.UPDATE_CONTENT,
      ipAddress: request.ip,
      detail: {
        scope: 'rules-quiz',
        previousAgreementVersion: current.agreement.version,
        agreementVersion: content.agreement.version,
        previousQuestionCount: current.quiz.questions.length,
        questionCount: content.quiz.questions.length,
      },
    },
  });

  response.json({ content });
});

adminRouter.put('/content/ui', async (request, response) => {
  const result = uiContentSchema.safeParse(request.body);

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '玩家端界面文案格式不正确',
      z.flattenError(result.error),
    );
  }

  const current = getContentConfig();
  const content = saveContentConfig({
    ...current,
    ui: result.data,
  });

  await prisma.adminLog.create({
    data: {
      adminId: response.locals.admin!.id,
      action: AdminAction.UPDATE_CONTENT,
      ipAddress: request.ip,
      detail: {
        scope: 'ui',
      },
    },
  });

  response.json({ content });
});

adminRouter.get('/settings', (_request, response) => {
  response.json(getAdminRuntimeConfig());
});

adminRouter.get('/version', async (_request, response) => {
  response.json(await getVersionStatus());
});

adminRouter.get('/logo', (_request, response) => {
  response.json(getSiteLogoStatus());
});

adminRouter.put('/logo', async (request, response) => {
  const result = updateLogoSchema.safeParse(request.body);

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Logo 上传数据格式不正确',
      z.flattenError(result.error),
    );
  }

  try {
    const status = saveSiteLogo(result.data.dataUrl);
    await prisma.adminLog.create({
      data: {
        adminId: response.locals.admin!.id,
        action: AdminAction.UPDATE_LOGO,
        ipAddress: request.ip,
        detail: { operation: 'upload' },
      },
    });
    response.json(status);
  } catch (error) {
    throw mapSiteLogoError(error);
  }
});

adminRouter.delete('/logo', async (request, response) => {
  const status = deleteSiteLogo();
  await prisma.adminLog.create({
    data: {
      adminId: response.locals.admin!.id,
      action: AdminAction.UPDATE_LOGO,
      ipAddress: request.ip,
      detail: { operation: 'delete' },
    },
  });
  response.json(status);
});

adminRouter.put('/settings', (request, response) => {
  const result = updateSettingsSchema.safeParse(request.body);

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '系统配置格式不正确',
      z.flattenError(result.error),
    );
  }

  try {
    response.json(
      updateRuntimeConfig({
        siteName: result.data.site.name,
        siteSubtitle: result.data.site.subtitle,
        server: {
          port:
            result.data.server?.port ?? getAdminRuntimeConfig().server.port,
        },
        application: result.data.application,
        rcon: {
          enabled: result.data.rcon.enabled,
          host: result.data.rcon.host,
          port: result.data.rcon.port,
          password: result.data.rcon.password,
          timeoutMs: result.data.rcon.timeoutMs,
          whitelistAddCommand:
            result.data.rcon.whitelistAddCommand,
          whitelistReloadCommand:
            result.data.rcon.whitelistReloadCommand || null,
          customCommandsEnabled: result.data.rcon.customCommandsEnabled,
          blockedCommands: result.data.rcon.blockedCommands,
        },
      }),
    );
  } catch (error) {
    throw new HttpError(
      400,
      'INVALID_RUNTIME_CONFIG',
      error instanceof Error ? error.message : '无法保存系统配置',
    );
  }
});

adminRouter.post('/system/factory-reset', async (request, response) => {
  const result = factoryResetSchema.safeParse(request.body);

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '恢复出厂设置确认文本不正确',
      z.flattenError(result.error),
    );
  }

  const resetResult = await factoryReset();

  response.clearCookie(
    adminSessionCookieName,
    getAdminSessionClearCookieOptions(request.secure),
  );
  response.json({
    setupRequired: true,
    setupToken: resetResult.setupToken,
  });
});

adminRouter.get('/rcon/status', async (_request, response) => {
  response.json(await getRconConnectionStatus());
});

adminRouter.post('/rcon/command', async (request, response) => {
  const result = rconCommandSchema.safeParse(request.body);

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'RCON 命令格式不正确',
      z.flattenError(result.error),
    );
  }

  try {
    const output = await executeRconCommand(result.data.command);
    response.json(output);
  } catch (error) {
    if (error instanceof RconCommandBlockedError) {
      throw new HttpError(403, 'RCON_COMMAND_BLOCKED', error.message, {
        blockedCommand: error.blockedCommand,
      });
    }

    if (error instanceof RconCustomCommandsDisabledError) {
      throw new HttpError(
        403,
        'RCON_CUSTOM_COMMANDS_DISABLED',
        error.message,
      );
    }

    if (error instanceof RconNotConfiguredError) {
      throw new HttpError(409, 'RCON_NOT_CONFIGURED', error.message);
    }

    throw new HttpError(
      503,
      'RCON_COMMAND_FAILED',
      error instanceof Error ? error.message : 'RCON 命令执行失败',
    );
  }
});

adminRouter.get('/applications', async (request, response) => {
  const rawStatus = request.query.status ?? 'pending_review';
  const status = rawStatus === 'all'
    ? null
    : parsePublicApplicationStatus(rawStatus);

  if (rawStatus !== 'all' && !status) {
    throw new HttpError(
      400,
      'INVALID_APPLICATION_STATUS',
      '申请状态筛选值无效',
    );
  }

  const search = typeof request.query.search === 'string'
    ? request.query.search.trim().slice(0, 64)
    : '';
  const applications = await listAdminApplications(status, search);

  response.json({
    status: status ?? 'all',
    applications: applications.map((application) => ({
      ...application,
      status: toPublicApplicationStatus(application.status),
    })),
  });
});

adminRouter.post('/applications', async (request, response) => {
  const result = createAdminApplicationSchema.safeParse(request.body);

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '手工录入的数据格式不正确',
      z.flattenError(result.error),
    );
  }

  try {
    const created = await createAdminApplication(
      result.data,
      response.locals.admin!.id,
      { ipAddress: request.ip },
    );
    const application = await getAdminApplication(created.id);

    response.status(201).json({
      application: {
        ...application!,
        status: toPublicApplicationStatus(application!.status),
      },
    });
  } catch (error) {
    throw mapApplicationRecordError(error);
  }
});

adminRouter.post('/applications/batch-review', async (request, response) => {
  const result = batchReviewSchema.safeParse(request.body);
  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '批量审核数据格式不正确',
      z.flattenError(result.error),
    );
  }

  const results: Array<{
    applicationId: string;
    success: boolean;
    status?: string;
    error?: string;
  }> = [];

  for (const applicationId of result.data.applicationIds) {
    try {
      const application =
        result.data.action === 'approve'
          ? await approveApplication(
              applicationId,
              response.locals.admin!.id,
              { ipAddress: request.ip },
            )
          : result.data.action === 'retry'
            ? await retryApplicationRcon(
                applicationId,
                response.locals.admin!.id,
                { ipAddress: request.ip },
              )
            : await rejectApplication(
                applicationId,
                response.locals.admin!.id,
                result.data.reason,
                { ipAddress: request.ip },
              );

      results.push({
        applicationId,
        success: true,
        status: toPublicApplicationStatus(application.status),
      });
    } catch (error) {
      results.push({
        applicationId,
        success: false,
        error: error instanceof Error ? error.message : '操作失败',
      });
    }
  }

  response.json({
    action: result.data.action,
    succeeded: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  });
});

adminRouter.get('/applications/:id', async (request, response) => {
  const application = await getAdminApplication(request.params.id);

  if (!application) {
    throw new HttpError(404, 'APPLICATION_NOT_FOUND', '申请记录不存在');
  }

  response.json({
    application: {
      ...application,
      status: toPublicApplicationStatus(application.status),
    },
  });
});

adminRouter.patch('/applications/:id', async (request, response) => {
  const result = updateAdminApplicationSchema.safeParse(request.body);

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '申请记录格式不正确',
      z.flattenError(result.error),
    );
  }

  try {
    await updateAdminApplication(
      request.params.id,
      result.data,
      response.locals.admin!.id,
      { ipAddress: request.ip },
    );
    const application = await getAdminApplication(request.params.id);

    response.json({
      application: {
        ...application!,
        status: toPublicApplicationStatus(application!.status),
      },
    });
  } catch (error) {
    throw mapApplicationRecordError(error);
  }
});

adminRouter.delete('/applications/:id', async (request, response) => {
  try {
    await deleteAdminApplication(
      request.params.id,
      response.locals.admin!.id,
      { ipAddress: request.ip },
    );
    response.status(204).end();
  } catch (error) {
    throw mapApplicationRecordError(error);
  }
});

adminRouter.post('/applications/:id/reject', async (request, response) => {
  const result = rejectApplicationSchema.safeParse(request.body);

  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      '拒绝原因格式不正确',
      z.flattenError(result.error),
    );
  }

  try {
    const application = await rejectApplication(
      request.params.id,
      response.locals.admin!.id,
      result.data.reason,
      { ipAddress: request.ip },
    );

    response.json({
      applicationId: application.id,
      status: toPublicApplicationStatus(application.status),
    });
  } catch (error) {
    throw mapReviewError(error);
  }
});

adminRouter.post('/applications/:id/approve', async (request, response) => {
  try {
    const application = await approveApplication(
      request.params.id,
      response.locals.admin!.id,
      { ipAddress: request.ip },
    );

    response.json({
      applicationId: application.id,
      status: toPublicApplicationStatus(application.status),
    });
  } catch (error) {
    throw mapReviewError(error);
  }
});

adminRouter.post(
  '/applications/:id/retry-rcon',
  async (request, response) => {
    try {
      const application = await retryApplicationRcon(
        request.params.id,
        response.locals.admin!.id,
        { ipAddress: request.ip },
      );

      response.json({
        applicationId: application.id,
        status: toPublicApplicationStatus(application.status),
      });
    } catch (error) {
      throw mapReviewError(error);
    }
  },
);

function mapReviewError(error: unknown) {
  if (!(error instanceof ReviewOperationError)) {
    return error;
  }

  const statusByCode: Record<string, number> = {
    APPLICATION_NOT_FOUND: 404,
    INVALID_APPLICATION_STATE: 409,
    RCON_OPERATION_IN_PROGRESS: 409,
    RCON_NOT_CONFIGURED: 503,
    RCON_EXECUTION_FAILED: 502,
  };

  return new HttpError(
    statusByCode[error.code] ?? 400,
    error.code,
    error.message,
    error.detail ? { detail: error.detail } : undefined,
  );
}

function mapApplicationRecordError(error: unknown) {
  if (!(error instanceof ApplicationRecordOperationError)) {
    return error;
  }

  return new HttpError(
    error.code === 'APPLICATION_NOT_FOUND' ? 404 : 409,
    error.code,
    error.message,
  );
}

function mapSiteLogoError(error: unknown) {
  if (!(error instanceof SiteLogoError)) {
    return error;
  }

  return new HttpError(400, error.code, error.message);
}
