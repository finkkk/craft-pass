import { createApp } from './app.js';
import { startupHttpPort } from './config/runtimeConfig.js';
import { initializeSetupBootstrap } from './services/setupService.js';
import { startVersionCheckScheduler } from './services/versionCheckService.js';

async function startServer() {
  await initializeSetupBootstrap();

  const app = createApp();
  startVersionCheckScheduler();
  const server = app.listen(startupHttpPort, () => {
    console.log(`Craft Pass 已启动：http://localhost:${startupHttpPort}`);
    console.log(
      `健康检查：http://localhost:${startupHttpPort}/api/health`,
    );
  });

  function shutdown(signal: NodeJS.Signals) {
    console.log(`收到 ${signal}，正在关闭服务……`);

    const forceShutdownTimer = setTimeout(() => {
      console.error('服务未能及时关闭，强制结束进程');
      process.exit(1);
    }, 10_000);
    forceShutdownTimer.unref();

    server.close((error) => {
      clearTimeout(forceShutdownTimer);

      if (error) {
        console.error('关闭服务失败', error);
        process.exitCode = 1;
      }
    });
  }

  server.on('error', (error) => {
    console.error('HTTP 服务启动失败', error);
    process.exitCode = 1;
  });

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error) => {
  console.error('Craft Pass 启动失败', error);
  process.exitCode = 1;
});
