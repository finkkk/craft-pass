import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const npmCliPath = process.env.npm_execpath;
const projectDirectory = fileURLToPath(new URL('../', import.meta.url));

if (!npmCliPath) {
  throw new Error('无法定位 npm CLI，请通过 npm start 启动 Craft Pass');
}

console.log('正在构建最新的前端和后端……');
const buildResult = spawnSync(
  process.execPath,
  [npmCliPath, 'run', 'build'],
  {
    cwd: projectDirectory,
    env: process.env,
    stdio: 'inherit',
  },
);

if (buildResult.error) {
  throw buildResult.error;
}

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

console.log('正在启动 Craft Pass 前端与后端单端口服务……');
await import('../backend/dist/server.js');
