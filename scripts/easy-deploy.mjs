import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const npmCliPath = process.env.npm_execpath;
const projectDirectory = fileURLToPath(new URL('../', import.meta.url));

if (!npmCliPath) {
  throw new Error('无法定位 npm CLI，请通过 npm run setup 执行一键部署');
}

const stages = [
  {
    label: '安装前后端依赖',
    args: ['run', 'install:all'],
  },
  {
    label: '构建前后端并应用数据库迁移',
    args: ['run', 'deploy'],
  },
  {
    label: '启动 Craft Pass 前端与后端单端口服务',
    args: ['run', 'start:server'],
  },
];

console.log('');
console.log('Craft Pass 一键部署开始');
console.log('完成后请保持此窗口运行，并打开控制台显示的部署链接。');

for (const stage of stages) {
  console.log(`\n[${stage.label}]`);

  const result = spawnSync(process.execPath, [npmCliPath, ...stage.args], {
    cwd: projectDirectory,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
