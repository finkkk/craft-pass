import { Router } from 'express';
import { z } from 'zod';
import { getPublicSiteConfig } from '../../config/runtimeConfig.js';
import { setupRateLimiter } from '../../middleware/security.js';
import { completeSetupSchema } from '../../schemas/setup.js';
import {
  completeSetup,
  getSetupStatus,
  SetupError,
} from '../../services/setupService.js';
import { HttpError } from '../../utils/HttpError.js';
import { getSiteLogo } from '../../services/siteLogoService.js';

export const setupRouter = Router();

setupRouter.get('/setup/status', async (_request, response) => {
  response.json(await getSetupStatus());
});

setupRouter.get('/site-config', (_request, response) => {
  response.json(getPublicSiteConfig());
});

setupRouter.get('/site-logo', (_request, response) => {
  const logo = getSiteLogo();

  if (!logo) {
    throw new HttpError(404, 'SITE_LOGO_NOT_FOUND', '尚未配置自定义 Logo');
  }

  response
    .set({
      'Content-Type': logo.mimeType,
      'Cache-Control': 'no-store',
    })
    .send(logo.bytes);
});

setupRouter.post(
  '/setup/complete',
  setupRateLimiter,
  async (request, response) => {
    const result = completeSetupSchema.safeParse(request.body);

    if (!result.success) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        '部署配置格式不正确',
        z.flattenError(result.error),
      );
    }

    try {
      const setupResult = await completeSetup(result.data);
      response.status(201).json({
        setupCompleted: true,
        ...setupResult,
      });
    } catch (error) {
      if (error instanceof SetupError) {
        throw new HttpError(
          error.code === 'INVALID_SETUP_TOKEN' ? 403 : 409,
          error.code,
          error.message,
        );
      }

      throw error;
    }
  },
);
