import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { requestContext } from './middleware/requestContext.js';
import {
  apiRateLimiter,
  createCorsOptions,
} from './middleware/security.js';
import { publicRouter } from './routes/public/index.js';
import { adminRouter } from './routes/admin/index.js';

const frontendDistDirectory = fileURLToPath(
  new URL('../../frontend/dist/', import.meta.url),
);
const frontendIndexFile = fileURLToPath(
  new URL('../../frontend/dist/index.html', import.meta.url),
);

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);

  app.use(requestContext);
  app.use(helmet());
  app.use(cors(createCorsOptions(env.corsOrigins)));
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRateLimiter);

  app.use('/api', publicRouter);
  app.use('/api/admin', adminRouter);

  if (existsSync(frontendIndexFile)) {
    app.use(express.static(frontendDistDirectory, { index: false }));
    app.use((request, response, next) => {
      if (
        request.method !== 'GET' ||
        request.path === '/api' ||
        request.path.startsWith('/api/') ||
        !request.accepts('html')
      ) {
        next();
        return;
      }

      response.sendFile(frontendIndexFile, (error) => {
        if (error) {
          next(error);
        }
      });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
