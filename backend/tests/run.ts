import { after } from 'node:test';
import { cleanupTestDatabase } from './setup.js';

await import('./applicationStatus.test.js');
await import('./adminPassword.test.js');
await import('./quizService.test.js');
await import('./app.test.js');

after(cleanupTestDatabase);
