import { useEffect, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  executeRconCommand,
  getAdminSession,
  getRconStatus,
} from '../../api/admin';
import type {
  AdminIdentity,
  RconCommandResult,
  RconStatus,
} from '../../types/admin';
import { AdminSidebar } from './AdminSidebar';

export function AdminRconPage() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [status, setStatus] = useState<RconStatus | null>(null);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<RconCommandResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAdminSession(), getRconStatus()])
      .then(([session, loadedStatus]) => {
        setAdmin(session.admin);
        setStatus(loadedStatus);
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

  async function refreshStatus(options: { clearError?: boolean } = {}) {
    setRefreshing(true);
    if (options.clearError ?? true) {
      setError(null);
    }
    try {
      setStatus(await getRconStatus());
    } catch (refreshError) {
      if (options.clearError ?? true) {
        setError(getMessage(refreshError));
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!status?.connected || !command.trim()) {
      return;
    }

    setExecuting(true);
    setError(null);
    try {
      const result = await executeRconCommand(command);
      setHistory((current) => [result, ...current].slice(0, 20));
      setCommand('');
      await refreshStatus();
    } catch (executeError) {
      setError(getMessage(executeError));
      await refreshStatus({ clearError: false });
    } finally {
      setExecuting(false);
    }
  }

  const commandDisabled =
    loading ||
    executing ||
    !status?.connected ||
    !status?.customCommandsEnabled;

  return (
    <div className="admin-shell">
      <AdminSidebar admin={admin} active="rcon" />

      <main className="admin-main rcon-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">RCON CONSOLE</p>
            <h1>RCON 控制台</h1>
          </div>
          <span className={status?.connected ? 'rcon-online' : 'rcon-offline'}>
            {status?.connected ? '连接成功' : '连接不可用'}
          </span>
        </header>

        {error ? <div className="admin-form-error">{error}</div> : null}

        <section className="rcon-console-grid">
          <article className="content-panel rcon-status-panel">
            <header>
              <div>
                <p className="eyebrow">CONNECTION</p>
                <h2>连接状态</h2>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={refreshing}
                onClick={() => void refreshStatus()}
              >
                {refreshing ? '检测中…' : '重新检测'}
              </button>
            </header>

            <dl className="rcon-status-list">
              <div>
                <dt>RCON 开关</dt>
                <dd>{status?.enabled ? '已启用' : '未启用'}</dd>
              </div>
              <div>
                <dt>认证连接</dt>
                <dd>{status?.connected ? '成功' : '失败'}</dd>
              </div>
              <div>
                <dt>白名单模板</dt>
                <dd>
                  {status?.whitelistAddCommandConfigured
                    ? '已包含 {minecraftId}'
                    : '模板不完整'}
                </dd>
              </div>
              <div>
                <dt>刷新命令</dt>
                <dd>{status?.reloadAfterAdd ? '已配置' : '未配置'}</dd>
              </div>
              <div>
                <dt>自定义命令</dt>
                <dd>{status?.customCommandsEnabled ? '允许' : '已关闭'}</dd>
              </div>
            </dl>

            {!status?.connected || !status.customCommandsEnabled ? (
              <p className="rcon-warning">
                {!status?.connected
                  ? status?.errorMessage ??
                    'RCON 暂不可用，命令输入已被禁用。'
                  : '自定义 RCON 命令已在系统配置中关闭。'}
              </p>
            ) : null}
          </article>

          <form
            className="content-panel rcon-command-panel"
            onSubmit={handleSubmit}
          >
            <header>
              <div>
                <p className="eyebrow">COMMAND</p>
                <h2>自定义命令</h2>
              </div>
              <button
                className="primary-button"
                type="submit"
                disabled={commandDisabled || !command.trim()}
              >
                {executing ? '执行中…' : '发送命令'}
              </button>
            </header>

            <label className="content-field">
              <span>命令内容</span>
              <input
                className="code-input"
                maxLength={300}
                value={command}
                disabled={commandDisabled}
                placeholder={
                  status?.connected
                    ? status.customCommandsEnabled
                      ? '例如：list'
                      : '系统配置开启后才能输入命令'
                    : 'RCON 连接成功后才能输入命令'
                }
                onChange={(event) => setCommand(event.target.value)}
              />
              <small>不要输入前导斜杠；命令会原样发送到 Minecraft 服务端。</small>
            </label>
          </form>
        </section>

        <section className="content-panel rcon-result-panel">
          <header>
            <div>
              <p className="eyebrow">OUTPUT</p>
              <h2>命令输出</h2>
            </div>
            <span>{history.length} 条</span>
          </header>

          {history.length > 0 ? (
            <div className="rcon-command-history">
              {history.map((item) => (
                <article key={`${item.executedAt}-${item.command}`}>
                  <div>
                    <strong>{item.command}</strong>
                    <span>{formatDate(item.executedAt)}</span>
                  </div>
                  <p>{item.response || '服务器未返回文本'}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              {status?.connected
                ? status.customCommandsEnabled
                  ? '还没有执行过自定义命令'
                  : '自定义 RCON 命令已关闭'
                : 'RCON 连接成功后会在这里显示命令输出'}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : 'RCON 操作失败，请稍后重试';
}
