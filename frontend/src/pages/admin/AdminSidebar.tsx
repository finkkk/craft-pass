import { logoutAdmin } from '../../api/admin';
import type { AdminIdentity } from '../../types/admin';
import { BrandMark } from '../../components/BrandMark';

type AdminSection = 'review' | 'statistics' | 'content' | 'settings';

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
  async function handleLogout() {
    await logoutAdmin().catch(() => undefined);
    window.location.href = '/admin/login';
  }

  return (
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/">
        <BrandMark className="admin-brand-mark" />
        CRAFT PASS
      </a>
      <nav>
        {navigation.map((item) => (
          <a
            className={active === item.id ? 'active' : undefined}
            href={item.href}
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
    </aside>
  );
}
