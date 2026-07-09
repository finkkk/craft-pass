import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AdminApiError,
  deleteAdminLogo,
  getAdminLogoStatus,
  getAdminSession,
  getAdminSettings,
  updateAdminLogo,
  updateAdminSettings,
} from '../../api/admin';
import type {
  AdminIdentity,
  AdminLogoStatus,
  AdminSettings,
} from '../../types/admin';
import { AdminSidebar } from './AdminSidebar';
import { BrandMark } from '../../components/BrandMark';

export function AdminSettingsPage() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [logoStatus, setLogoStatus] = useState<AdminLogoStatus | null>(
    null,
  );
  const [rconPassword, setRconPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getAdminSession(),
      getAdminSettings(),
      getAdminLogoStatus(),
    ])
      .then(([session, loadedSettings, loadedLogoStatus]) => {
        setAdmin(session.admin);
        setSettings(loadedSettings);
        setLogoStatus(loadedLogoStatus);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof AdminApiError && loadError.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        setError(getMessage(loadError));
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settings) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await updateAdminSettings({
        site: settings.site,
        rcon: {
          enabled: settings.rcon.enabled,
          host: settings.rcon.host,
          port: settings.rcon.port,
          password: rconPassword || undefined,
          timeoutMs: settings.rcon.timeoutMs,
          whitelistAddCommand: settings.rcon.whitelistAddCommand,
          whitelistReloadCommand: settings.rcon.whitelistReloadCommand,
        },
      });
      setSettings(updated);
      setRconPassword('');
      setMessage('配置已保存，新配置会立即用于后续请求。');
    } catch (saveError) {
      setError(getMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Logo 只支持 PNG、JPEG 或 WebP 图片');
      return;
    }

    if (file.size > 400 * 1024) {
      setError('Logo 文件不能超过 400KB');
      return;
    }

    setLogoSaving(true);
    setError(null);
    setMessage(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoStatus(await updateAdminLogo(dataUrl));
      setMessage('Logo 已更新，刷新其他页面后生效。');
    } catch (uploadError) {
      setError(getMessage(uploadError));
    } finally {
      setLogoSaving(false);
    }
  }

  async function handleRemoveLogo() {
    if (!window.confirm('确认移除自定义 Logo 并恢复默认 CP 图标吗？')) {
      return;
    }

    setLogoSaving(true);
    setError(null);
    setMessage(null);
    try {
      setLogoStatus(await deleteAdminLogo());
      setMessage('自定义 Logo 已移除。');
    } catch (removeError) {
      setError(getMessage(removeError));
    } finally {
      setLogoSaving(false);
    }
  }

  return (
    <div className="admin-shell">
      <AdminSidebar admin={admin} active="settings" />

      <main className="admin-main settings-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">SYSTEM SETTINGS</p>
            <h1>系统配置</h1>
          </div>
          <span className="rcon-online">
            {settings?.source === 'runtime' ? '网页配置' : '环境变量配置'}
          </span>
        </header>

        {error ? <div className="admin-form-error">{error}</div> : null}
        {message ? <div className="settings-success">{message}</div> : null}

        {loading || !settings ? (
          <div className="settings-loading">正在读取加密配置…</div>
        ) : (
          <form className="settings-form" onSubmit={handleSubmit}>
            <section>
              <header>
                <div>
                  <p>01</p>
                  <h2>站点信息</h2>
                </div>
                <span>保存后刷新玩家页面生效</span>
              </header>
              <div className="settings-fields two">
                <SettingsField label="站点名称">
                  <input
                    minLength={2}
                    maxLength={60}
                    value={settings.site.name}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        site: { ...settings.site, name: event.target.value },
                      })
                    }
                    required
                  />
                </SettingsField>
                <SettingsField label="站点副标题">
                  <input
                    minLength={2}
                    maxLength={100}
                    value={settings.site.subtitle}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        site: {
                          ...settings.site,
                          subtitle: event.target.value,
                        },
                      })
                    }
                    required
                  />
                </SettingsField>
                <div className="logo-settings-panel">
                  <BrandMark
                    className="logo-settings-preview"
                    key={logoStatus?.url ?? 'default-logo'}
                    logoUrl={logoStatus?.url ?? '/api/site-logo'}
                  />
                  <div>
                    <strong>站点 Logo</strong>
                    <p>支持 PNG、JPEG、WebP，建议使用正方形图片，最大 400KB。</p>
                  </div>
                  <label className="secondary-button logo-upload-button">
                    {logoSaving ? '正在处理…' : '选择图片'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={logoSaving}
                      onChange={(event) => void handleLogoFile(event)}
                    />
                  </label>
                  {logoStatus?.configured ? (
                    <button
                      className="logo-remove-button"
                      type="button"
                      disabled={logoSaving}
                      onClick={() => void handleRemoveLogo()}
                    >
                      恢复默认
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section>
              <header>
                <div>
                  <p>02</p>
                  <h2>RCON 连接</h2>
                </div>
                <span>密码永远不会从后端返回</span>
              </header>
              <div className="settings-fields">
                <label className="setup-toggle">
                  <input
                    type="checkbox"
                    checked={settings.rcon.enabled}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        rcon: {
                          ...settings.rcon,
                          enabled: event.target.checked,
                        },
                      })
                    }
                  />
                  <span />
                  <p>
                    <strong>启用 RCON 白名单操作</strong>
                    关闭后批准和重试按钮会被禁用
                  </p>
                </label>

                <div className="settings-fields three">
                  <SettingsField label="主机">
                    <input
                      maxLength={255}
                      value={settings.rcon.host}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          rcon: {
                            ...settings.rcon,
                            host: event.target.value,
                          },
                        })
                      }
                      required
                    />
                  </SettingsField>
                  <SettingsField label="端口">
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={settings.rcon.port}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          rcon: {
                            ...settings.rcon,
                            port: Number(event.target.value),
                          },
                        })
                      }
                      required
                    />
                  </SettingsField>
                  <SettingsField label="超时（ms）">
                    <input
                      type="number"
                      min={500}
                      max={30000}
                      value={settings.rcon.timeoutMs}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          rcon: {
                            ...settings.rcon,
                            timeoutMs: Number(event.target.value),
                          },
                        })
                      }
                      required
                    />
                  </SettingsField>
                </div>

                <SettingsField
                  label="RCON 密码"
                  help={
                    settings.rcon.passwordConfigured
                      ? '已配置密码；留空表示保持原密码'
                      : '当前没有可用密码'
                  }
                >
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={rconPassword ? 8 : undefined}
                    maxLength={256}
                    value={rconPassword}
                    onChange={(event) => setRconPassword(event.target.value)}
                    placeholder={
                      settings.rcon.passwordConfigured
                        ? '••••••••••••'
                        : '输入至少 8 位密码'
                    }
                  />
                </SettingsField>

                <SettingsField
                  label="加入白名单命令"
                  help="必须包含 {minecraftId}"
                >
                  <input
                    className="code-input"
                    maxLength={200}
                    value={settings.rcon.whitelistAddCommand}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        rcon: {
                          ...settings.rcon,
                          whitelistAddCommand: event.target.value,
                        },
                      })
                    }
                    required
                  />
                </SettingsField>

                <SettingsField
                  label="刷新命令"
                  help="可留空"
                >
                  <input
                    className="code-input"
                    maxLength={200}
                    value={settings.rcon.whitelistReloadCommand}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        rcon: {
                          ...settings.rcon,
                          whitelistReloadCommand: event.target.value,
                        },
                      })
                    }
                  />
                </SettingsField>
              </div>
            </section>

            <footer>
              <p>配置文件与加密密钥必须一起备份。</p>
              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? '正在保存…' : '保存系统配置'}
                <span>→</span>
              </button>
            </footer>
          </form>
        )}
      </main>
    </div>
  );
}

function SettingsField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="setup-field">
      <span>{label}</span>
      {children}
      {help ? <small>{help}</small> : null}
    </label>
  );
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('无法读取 Logo 文件'));
      }
    });
    reader.addEventListener('error', () => {
      reject(new Error('无法读取 Logo 文件'));
    });
    reader.readAsDataURL(file);
  });
}
