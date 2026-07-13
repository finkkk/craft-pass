import { useEffect, useState, type FormEvent } from 'react';
import { minimumRconPasswordLength } from '../../constants';
import {
  AdminApiError,
  factoryResetSystem,
  getAdminContent,
  getAdminSession,
  getAdminSettings,
  getRconStatus,
  updateAdminSettings,
} from '../../api/admin';
import type {
  AdminContentConfig,
  AdminIdentity,
  AdminSettings,
  RconStatus,
} from '../../types/admin';
import { AdminSidebar } from './AdminSidebar';

export function AdminSettingsPage() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [content, setContent] = useState<AdminContentConfig | null>(null);
  const [rconStatus, setRconStatus] = useState<RconStatus | null>(null);
  const [rconPassword, setRconPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getAdminSession(),
      getAdminSettings(),
      getAdminContent(),
      getRconStatus().catch(() => null),
    ])
      .then(([session, loadedSettings, loadedContent, loadedRconStatus]) => {
        setAdmin(session.admin);
        setSettings(loadedSettings);
        setContent(loadedContent);
        setRconStatus(loadedRconStatus);
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
        server: { port: settings.server.port },
        application: settings.application,
        rcon: {
          enabled: settings.rcon.enabled,
          host: settings.rcon.host,
          port: settings.rcon.port,
          password: rconPassword || undefined,
          timeoutMs: settings.rcon.timeoutMs,
          whitelistAddCommand: settings.rcon.whitelistAddCommand,
          whitelistReloadCommand: settings.rcon.whitelistReloadCommand,
          customCommandsEnabled: settings.rcon.customCommandsEnabled,
          blockedCommands: normalizeBlockedCommands(
            settings.rcon.blockedCommands,
          ),
        },
      });
      setSettings(updated);
      setRconPassword('');
      setRconStatus(await getRconStatus().catch(() => null));
      setMessage(
        updated.server.restartRequired
          ? `系统配置已保存。HTTP 端口将在重启服务后改为 ${updated.server.port}。`
          : '系统配置已保存，新配置会立即用于后续请求。',
      );
    } catch (saveError) {
      setError(getMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function updateApplication(
    update: Partial<AdminSettings['application']>,
  ) {
    setSettings((current) =>
      current
        ? {
            ...current,
            application: { ...current.application, ...update },
          }
        : current,
    );
  }

  function updateRcon(update: Partial<AdminSettings['rcon']>) {
    setSettings((current) =>
      current
        ? {
            ...current,
            rcon: { ...current.rcon, ...update },
          }
        : current,
    );
  }

  async function handleFactoryReset() {
    if (
      resetConfirmation !== 'RESET' ||
      !window.confirm(
        '确认恢复出厂设置吗？所有申请、管理员账号、配置、题库和 Logo 都会被清空，系统会回到首次部署状态。',
      )
    ) {
      return;
    }

    setResetting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await factoryResetSystem(resetConfirmation);
      sessionStorage.setItem('craft_pass_setup_token', result.setupToken);
      window.location.href = '/setup';
    } catch (resetError) {
      setError(getMessage(resetError));
      setResetting(false);
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
          <div className="settings-loading">正在读取系统配置…</div>
        ) : (
          <>
            <section className="settings-status-grid">
              <StatusCard
                label="申请入口"
                value={
                  settings.application.submissionsEnabled ? '开放' : '关闭'
                }
                tone={
                  settings.application.submissionsEnabled ? 'green' : 'red'
                }
                detail="QQ 与 Minecraft ID 全状态唯一"
              />
              <StatusCard
                label="HTTP 服务"
                value={`:${settings.server.activePort}`}
                tone={settings.server.restartRequired ? 'red' : 'green'}
                detail={
                  settings.server.restartRequired
                    ? `重启后改为 :${settings.server.port}`
                    : '当前监听端口'
                }
              />
              <StatusCard
                label="题库状态"
                value={content ? `${content.quiz.questions.length} 题` : '未知'}
                detail={
                  content
                    ? `协议 ${content.agreement.version}`
                    : '内容配置未读取'
                }
              />
              <StatusCard
                label="RCON 连接"
                value={
                  !settings.rcon.enabled
                    ? '未启用'
                    : rconStatus?.connected
                      ? '成功'
                      : '失败'
                }
                tone={rconStatus?.connected ? 'green' : 'red'}
                detail={rconStatus?.errorMessage ?? '用于白名单与命令控制台'}
              />
              <StatusCard
                label="命令安全"
                value={
                  settings.rcon.customCommandsEnabled ? '允许自定义' : '已关闭'
                }
                detail={`${settings.rcon.blockedCommands.length} 条黑名单`}
              />
            </section>

            <form className="settings-form" onSubmit={handleSubmit}>
              <section>
                <header>
                  <div>
                    <p>01</p>
                    <h2>HTTP 服务端口</h2>
                  </div>
                  <span>修改后需要重启 Craft Pass 服务，新的访问地址才会生效。</span>
                </header>
                <div className="settings-fields">
                  <SettingsField
                    label="网页与 API 端口"
                    help={`当前正在使用 ${settings.server.activePort}；有效范围 1–65535`}
                  >
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      disabled={settings.server.locked}
                      value={settings.server.port}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                server: {
                                  ...current.server,
                                  port: Number(event.target.value),
                                },
                              }
                            : current,
                        )
                      }
                      required
                    />
                  </SettingsField>
                  {settings.server.restartRequired ? (
                    <p className="settings-restart-notice">
                      已保存的端口为 {settings.server.port}，请重启服务后访问
                      {' '}
                      <code>http://localhost:{settings.server.port}</code>。
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <header>
                  <div>
                    <p>02</p>
                    <h2>申请入口与 IP 频率限制</h2>
                  </div>
                  <span>QQ 与 Minecraft ID 会全状态查重；这里额外限制同一 IP 的短时间提交。</span>
                </header>
                <div className="settings-fields">
                  <label className="setup-toggle">
                    <input
                      type="checkbox"
                      checked={settings.application.submissionsEnabled}
                      onChange={(event) =>
                        updateApplication({
                          submissionsEnabled: event.target.checked,
                        })
                      }
                    />
                    <span />
                    <p>
                      <strong>开放玩家申请入口</strong>
                      关闭后玩家仍可浏览规则和题目，但无法提交新申请
                    </p>
                  </label>

                  <div className="settings-fields rate-limit-grid">
                    <SettingsField
                      label="提交统计时段（分钟）"
                      help="同 IP 最大提交数按这个时间段统计，不是答题限时"
                    >
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={settings.application.rateLimitWindowMinutes}
                        onChange={(event) =>
                          updateApplication({
                            rateLimitWindowMinutes: Number(event.target.value),
                          })
                        }
                        required
                      />
                    </SettingsField>
                    <SettingsField
                      label="同 IP 最大提交"
                      help="在上面的统计时段内最多允许提交几次"
                    >
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={settings.application.maxSubmissionsPerIp}
                        onChange={(event) =>
                          updateApplication({
                            maxSubmissionsPerIp: Number(event.target.value),
                          })
                        }
                        required
                      />
                    </SettingsField>
                  </div>
                </div>
              </section>

              <section>
                <header>
                  <div>
                    <p>03</p>
                    <h2>RCON 连接</h2>
                  </div>
                  <span>密码永远不会从后端返回，留空表示保持原密码。</span>
                </header>
                <div className="settings-fields">
                  <label className="setup-toggle">
                    <input
                      type="checkbox"
                      checked={settings.rcon.enabled}
                      onChange={(event) =>
                        updateRcon({ enabled: event.target.checked })
                      }
                    />
                    <span />
                    <p>
                      <strong>启用 RCON 白名单操作</strong>
                      关闭后批准、重试和命令控制台都会被禁用
                    </p>
                  </label>

                  <div className="settings-fields three">
                    <SettingsField label="主机">
                      <input
                        maxLength={255}
                        value={settings.rcon.host}
                        onChange={(event) =>
                          updateRcon({ host: event.target.value })
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
                          updateRcon({ port: Number(event.target.value) })
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
                          updateRcon({ timeoutMs: Number(event.target.value) })
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
                      minLength={
                        rconPassword ? minimumRconPasswordLength : undefined
                      }
                      maxLength={256}
                      value={rconPassword}
                      onChange={(event) => setRconPassword(event.target.value)}
                      placeholder={
                        settings.rcon.passwordConfigured
                          ? '••••••••••••'
                          : `输入至少 ${minimumRconPasswordLength} 位密码`
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
                        updateRcon({
                          whitelistAddCommand: event.target.value,
                        })
                      }
                      required
                    />
                  </SettingsField>

                  <SettingsField label="刷新命令" help="可留空">
                    <input
                      className="code-input"
                      maxLength={200}
                      value={settings.rcon.whitelistReloadCommand}
                      onChange={(event) =>
                        updateRcon({
                          whitelistReloadCommand: event.target.value,
                        })
                      }
                    />
                  </SettingsField>
                </div>
              </section>

              <section>
                <header>
                  <div>
                    <p>04</p>
                    <h2>自定义命令安全</h2>
                  </div>
                  <span>用于 RCON 控制台；白名单审核命令不受此开关影响。</span>
                </header>
                <div className="settings-fields">
                  <label className="setup-toggle">
                    <input
                      type="checkbox"
                      checked={settings.rcon.customCommandsEnabled}
                      onChange={(event) =>
                        updateRcon({
                          customCommandsEnabled: event.target.checked,
                        })
                      }
                    />
                    <span />
                    <p>
                      <strong>允许后台发送自定义 RCON 命令</strong>
                      关闭后 RCON 控制台只显示状态，不允许输入命令
                    </p>
                  </label>

                  <SettingsField
                    label="危险命令黑名单"
                    help="每行一条，按命令前缀匹配；例如 op 会拦截 op Steve"
                  >
                    <textarea
                      className="code-input"
                      rows={8}
                      value={settings.rcon.blockedCommands.join('\n')}
                      onChange={(event) =>
                        updateRcon({
                          blockedCommands: event.target.value.split(/\r?\n/),
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

            <section className="settings-danger-zone">
              <header>
                <div>
                  <p>RESET</p>
                  <h2>恢复出厂设置</h2>
                </div>
                <span>清空所有数据并回到首次部署流程。</span>
              </header>
              <div>
                <p>
                  该操作会删除申请记录、管理员账号、会话、操作日志、RCON
                  记录、运行配置、题库配置和自定义 Logo。完成后会跳转到部署页。
                </p>
                <label className="setup-field">
                  <span>输入 RESET 确认</span>
                  <input
                    value={resetConfirmation}
                    onChange={(event) =>
                      setResetConfirmation(event.target.value)
                    }
                    autoComplete="off"
                  />
                </label>
                <button
                  className="danger-button"
                  type="button"
                  disabled={resetting || resetConfirmation !== 'RESET'}
                  onClick={() => void handleFactoryReset()}
                >
                  {resetting ? '正在重置…' : '恢复出厂设置'}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatusCard({
  label,
  value,
  detail,
  tone = '',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'green' | 'red' | '';
}) {
  return (
    <article className={`settings-status-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
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

function normalizeBlockedCommands(commands: string[]) {
  return Array.from(
    new Set(commands.map((command) => command.trim()).filter(Boolean)),
  );
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}
