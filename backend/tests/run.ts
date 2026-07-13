import { after } from 'node:test';
import { cleanupTestDatabase } from './setup.js';

await import('./applicationStatus.test.js');
await import('./adminPassword.test.js');
await import('./rconPassword.test.js');
await import('./promiseTimeout.test.js');
await import('./quizService.test.js');
await import('./versionCheckService.test.js');
await import('./app.test.js');

after(cleanupTestDatabase);
