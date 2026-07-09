import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const npmCliPath = process.env.npm_execpath;
const installCommand = process.argv.includes('--ci') ? 'ci' : 'install';

if (!npmCliPath) {
  throw new Error('无法定位 npm CLI，请通过 npm run install:all 执行安装');
}

for (const directory of ['frontend', 'backend']) {
  console.log(`\n正在安装 ${directory} 依赖……`);

  const childEnvironment = { ...process.env };

  delete childEnvironment.INIT_CWD;
  delete childEnvironment.npm_config_local_prefix;
  delete childEnvironment.npm_package_json;

  for (const key of Object.keys(childEnvironment)) {
    if (key.startsWith('npm_package_')) {
      delete childEnvironment[key];
    }
  }

  const result = spawnSync(process.execPath, [npmCliPath, installCommand], {
    cwd: fileURLToPath(new URL(`../${directory}/`, import.meta.url)),
    env: childEnvironment,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\n前后端依赖安装完成。');
