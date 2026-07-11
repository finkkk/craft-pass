import { getAdminVersionStatus, logoutAdmin } from '../../api/admin';
import { useEffect, useState } from 'react';
import type { VersionStatus } from '../../types/admin';
import type { AdminIdentity } from '../../types/admin';
import { BrandMark } from '../../components/BrandMark';
import { handleInternalNavigation } from '../../navigation';

type AdminSection =
  | 'review'
  | 'statistics'
  | 'content'
  | 'appearance'
  | 'rcon'
  | 'settings';

const navigation = [
  { id: 'review', href: '/admin', icon: '⌂', label: '审核中心' },
  {
    id: 'statistics',
    href: '/admin/statistics',
    icon: '▥',
    label: '数据统计',
  },
  {
    id: 'content',
    href: '/admin/content',
    icon: '✎',
    label: '题库与服规',
  },
  {
    id: 'appearance',
    href: '/admin/appearance',
    icon: '◇',
    label: '界面定制',
  },
  {
    id: 'rcon',
    href: '/admin/rcon',
    icon: '>',
    label: 'RCON 控制台',
  },
  {
    id: 'settings',
    href: '/admin/settings',
    icon: '⚙',
    label: '系统配置',
  },
] as const;

export function AdminSidebar({
  admin,
  active,
}: {
  admin: AdminIdentity | null;
  active: AdminSection;
}) {
  const [versionStatus, setVersionStatus] = useState<VersionStatus | null>(null);

  useEffect(() => {
    function checkVersion() {
      void getAdminVersionStatus()
        .then((status) => {
          if (
            status.updateAvailable &&
            sessionStorage.getItem('craft_pass_dismissed_release') !==
              status.latestVersion
          ) {
            setVersionStatus(status);
          }
        })
        .catch(() => undefined);
    }

    checkVersion();
    const timer = window.setInterval(checkVersion, 30 * 60 * 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleLogout() {
    await logoutAdmin().catch(() => undefined);
    window.location.href = '/admin/login';
  }

  return (
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/">
        <BrandMark className="admin-brand-mark" />
        <strong className="admin-brand-name">Craft Pass</strong>
      </a>
      <nav>
        {navigation.map((item) => (
          <a
            className={active === item.id ? 'active' : undefined}
            href={item.href}
            onClick={(event) => handleInternalNavigation(event, item.href)}
            key={item.id}
          >
            <span>{item.icon}</span>
            {item.label}
          </a>
        ))}
        <a href="/" target="_blank" rel="noreferrer">
          <span>↗</span>玩家入口
        </a>
      </nav>
      <div className="admin-profile">
        <span>{admin?.username.slice(0, 1).toUpperCase() ?? 'A'}</span>
        <p>
          <strong>{admin?.username ?? '加载中'}</strong>
          <small>{admin?.role ?? 'admin'}</small>
        </p>
        <button type="button" onClick={() => void handleLogout()}>
          退出
        </button>
      </div>
      <a
        className="admin-project-credit"
        href="https://github.com/finkkk/craft-pass"
        target="_blank"
        rel="noreferrer"
      >
        作者 finkkk · craft-pass
      </a>
      {versionStatus ? (
        <div className="version-update-toast" role="status">
          <button
            type="button"
            aria-label="关闭版本提醒"
            onClick={() => {
              sessionStorage.setItem(
                'craft_pass_dismissed_release',
                versionStatus.latestVersion ?? '',
              );
              setVersionStatus(null);
            }}
          >
            ×
          </button>
          <small>发现新版本</small>
          <strong>{versionStatus.latestVersion}</strong>
          <p>当前版本 {versionStatus.currentVersion}</p>
          <a href={versionStatus.releaseUrl} target="_blank" rel="noreferrer">
            前往 GitHub 查看 →
          </a>
        </div>
      ) : null}
    </aside>
  );
}
