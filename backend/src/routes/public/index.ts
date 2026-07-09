import { Router } from 'express';
import { applicationsRouter } from './applications.js';
import { healthRouter } from './health.js';
import { setupRouter } from './setup.js';

export const publicRouter = Router();

publicRouter.use(healthRouter);
publicRouter.use(applicationsRouter);
publicRouter.use(setupRouter);
