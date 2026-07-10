import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AdminApiError,
  deleteAdminLogo,
  getAdminContent,
  getAdminLogoStatus,
  getAdminSession,
  getAdminSettings,
  updateAdminUiContent,
  updateAdminLogo,
  updateAdminSettings,
} from '../../api/admin';
import type {
  AdminContentConfig,
  AdminIdentity,
  AdminLogoStatus,
  AdminSettings,
} from '../../types/admin';
import { BrandMark } from '../../components/BrandMark';
import { AdminSidebar } from './AdminSidebar';
import { UiCopyEditor } from './AdminContentPage';

export function AdminAppearancePage() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [content, setContent] = useState<AdminContentConfig | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [logoStatus, setLogoStatus] = useState<AdminLogoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSite, setSavingSite] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getAdminSession(),
      getAdminContent(),
      getAdminSettings(),
      getAdminLogoStatus(),
    ])
      .then(
        ([
          session,
          loadedContent,
          loadedSettings,
          loadedLogoStatus,
        ]) => {
          setAdmin(session.admin);
          setContent(loadedContent);
          setSettings(loadedSettings);
          setLogoStatus(loadedLogoStatus);
        },
      )
      .catch((loadError: unknown) => {
        if (loadError instanceof AdminApiError && loadError.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        setError(getMessage(loadError));
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSiteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settings) {
      return;
    }

    setSavingSite(true);
    setError(null);
    setMessage(null);
    try {
      setSettings(
        await updateAdminSettings({
          site: settings.site,
          application: settings.application,
          rcon: {
            enabled: settings.rcon.enabled,
            host: settings.rcon.host,
            port: settings.rcon.port,
            timeoutMs: settings.rcon.timeoutMs,
            whitelistAddCommand: settings.rcon.whitelistAddCommand,
            whitelistReloadCommand: settings.rcon.whitelistReloadCommand,
            customCommandsEnabled: settings.rcon.customCommandsEnabled,
            blockedCommands: settings.rcon.blockedCommands,
          },
        }),
      );
      setMessage('站点名称与副标题已保存。');
    } catch (saveError) {
      setError(getMessage(saveError));
    } finally {
      setSavingSite(false);
    }
  }

  async function handleCopySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!content) {
      return;
    }

    setSavingCopy(true);
    setError(null);
    setMessage(null);
    try {
      setContent(await updateAdminUiContent(content.ui));
      setMessage('玩家端文案已保存，刷新玩家页面后生效。');
    } catch (saveError) {
      setError(getMessage(saveError));
    } finally {
      setSavingCopy(false);
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
      <AdminSidebar admin={admin} active="appearance" />

      <main className="admin-main content-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">APPEARANCE</p>
            <h1>界面定制</h1>
          </div>
          <span className="rcon-online">玩家端显示</span>
        </header>

        {error ? <div className="admin-form-error">{error}</div> : null}
        {message ? <div className="settings-success">{message}</div> : null}

        {loading || !content || !settings ? (
          <div className="settings-loading">正在读取界面配置…</div>
        ) : (
          <div className="appearance-layout">
            <form className="settings-form" onSubmit={handleSiteSubmit}>
              <section>
                <header>
                  <div>
                    <p>01</p>
                    <h2>站点信息</h2>
                  </div>
                  <span>名称、副标题和 Logo 会显示在玩家端与后台顶部。</span>
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
                          site: {
                            ...settings.site,
                            name: event.target.value,
                          },
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
                      <p>
                        支持 PNG、JPEG、WebP，建议使用正方形图片，最大 400KB。
                      </p>
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
              <footer>
                <p>这些内容不影响题库、服规或 RCON 配置。</p>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={savingSite}
                >
                  {savingSite ? '正在保存…' : '保存站点信息'}
                  <span>→</span>
                </button>
              </footer>
            </form>

            <form className="content-form" onSubmit={handleCopySubmit}>
              <UiCopyEditor content={content} onChange={setContent} />
              <footer className="content-save-bar">
                <p>这里只修改玩家端显示文案，不会改动服规正文或题库答案。</p>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={savingCopy}
                >
                  {savingCopy ? '正在保存…' : '保存玩家端文案'}
                  <span>→</span>
                </button>
              </footer>
            </form>
          </div>
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
  return error instanceof Error ? error.message : '界面配置操作失败，请稍后重试';
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
