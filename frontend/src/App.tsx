import { useEffect, useState } from 'react';
import { getSetupStatus } from './api/setup';
import { AdminApp } from './pages/admin/AdminApp';
import { PlayerApp } from './pages/player/PlayerApp';
import { SetupApp } from './pages/setup/SetupApp';
import type { SetupStatus } from './types/setup';

export function App() {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    getSetupStatus()
      .then(setSetupStatus)
      .catch((error: unknown) =>
        setSetupError(
          error instanceof Error ? error.message : '无法读取部署状态',
        ),
      );
  }, []);

  if (setupError) {
    return (
      <main className="bootstrap-loading">
        <strong>无法连接 Craft Pass 后端</strong>
        <p>{setupError}</p>
        <button type="button" onClick={() => window.location.reload()}>
          重新连接
        </button>
      </main>
    );
  }

  if (!setupStatus) {
    return <main className="bootstrap-loading">正在检查部署状态…</main>;
  }

  if (
    setupStatus.setupRequired &&
    window.location.pathname !== '/setup'
  ) {
    window.location.replace('/setup');
    return <main className="bootstrap-loading">正在进入部署向导…</main>;
  }

  if (window.location.pathname === '/setup') {
    return <SetupApp initialStatus={setupStatus} />;
  }

  return window.location.pathname.startsWith('/admin') ? (
    <AdminApp />
  ) : (
    <PlayerApp site={setupStatus.site} />
  );
}
