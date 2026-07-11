import { lazy, Suspense, useEffect, useState } from 'react';
import { getSetupStatus } from './api/setup';
import { PlayerApp } from './pages/player/PlayerApp';
import { SetupApp } from './pages/setup/SetupApp';
import type { PublicSiteConfig, SetupStatus } from './types/setup';
import { ApiClientError } from './api/client';

const AdminApp = lazy(() =>
  import('./pages/admin/AdminApp').then((module) => ({
    default: module.AdminApp,
  })),
);

export function App() {
  const pathname = usePathname();
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupError, setSetupError] = useState<Error | null>(null);

  useDocumentBrand(setupStatus?.site ?? null);

  useEffect(() => {
    void loadSetupStatus();
  }, []);

  async function loadSetupStatus() {
    setSetupError(null);
    try {
      setSetupStatus(await getSetupStatus());
    } catch (error) {
      setSetupError(
        error instanceof Error ? error : new Error('无法读取部署状态'),
      );
    }
  }

  if (setupError) {
    return (
      <main className="bootstrap-loading">
        <strong>
          {setupError instanceof ApiClientError && setupError.status === 0
            ? '无法连接 Craft Pass 后端'
            : '暂时无法加载 Craft Pass'}
        </strong>
        <p>{setupError.message}</p>
        <button type="button" onClick={() => void loadSetupStatus()}>
          重新尝试
        </button>
      </main>
    );
  }

  if (!setupStatus) {
    return <main className="bootstrap-loading">正在检查部署状态…</main>;
  }

  if (
    setupStatus.setupRequired &&
    pathname !== '/setup'
  ) {
    window.location.replace('/setup');
    return <main className="bootstrap-loading">正在进入部署向导…</main>;
  }

  if (pathname === '/setup') {
    return <SetupApp initialStatus={setupStatus} />;
  }

  return pathname.startsWith('/admin') ? (
    <Suspense fallback={<main className="bootstrap-loading">正在加载管理后台…</main>}>
      <AdminApp site={setupStatus.site} pathname={pathname} />
    </Suspense>
  ) : (
    <PlayerApp site={setupStatus.site} />
  );
}

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const updatePathname = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', updatePathname);
    return () => window.removeEventListener('popstate', updatePathname);
  }, []);

  return pathname;
}

function useDocumentBrand(site: PublicSiteConfig | null) {
  useEffect(() => {
    const siteName = site?.name.trim() || 'Craft Pass';
    document.title = siteName;

    const favicon = getOrCreateFavicon();
    const fallbackFavicon = createFallbackFavicon(siteName);
    const controller = new AbortController();

    fetch('/api/site-logo', {
      cache: 'no-store',
      method: 'HEAD',
      signal: controller.signal,
    })
      .then((response) => {
        favicon.href = response.ok
          ? `/api/site-logo?v=${Date.now()}`
          : fallbackFavicon;
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          favicon.href = fallbackFavicon;
        }
      });

    return () => controller.abort();
  }, [site?.name]);
}

function getOrCreateFavicon() {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (existing) {
    return existing;
  }

  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  document.head.appendChild(favicon);
  return favicon;
}

function createFallbackFavicon(siteName: string) {
  const initials =
    siteName
      .match(/[a-zA-Z0-9\u4e00-\u9fa5]/g)
      ?.slice(0, 2)
      .join('')
      .toUpperCase() || 'CP';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#245f3b"/><text x="32" y="39" text-anchor="middle" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
