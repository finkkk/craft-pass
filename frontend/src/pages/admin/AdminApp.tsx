import { useEffect, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  approveAdminApplication,
  deleteAdminApplication,
  getAdminApplication,
  getAdminApplications,
  getAdminSession,
  getAdminSummary,
  getRconStatus,
  loginAdmin,
  rejectAdminApplication,
  retryAdminApplicationRcon,
  updateAdminApplication,
} from '../../api/admin';
import type {
  AdminApplicationDetail,
  AdminApplicationRow,
  AdminIdentity,
  AdminSummary,
  ApplicationStatus,
  RconStatus,
} from '../../types/admin';
import { AdminSettingsPage } from './AdminSettingsPage';
import { AdminStatisticsPage } from './AdminStatisticsPage';
import { AdminContentPage } from './AdminContentPage';
import { AdminAppearancePage } from './AdminAppearancePage';
import { AdminRconPage } from './AdminRconPage';
import { AdminSidebar } from './AdminSidebar';
import { BrandMark } from '../../components/BrandMark';
import type { PublicSiteConfig } from '../../types/setup';

const statusTabs: Array<{ id: ApplicationStatus; label: string }> = [
  { id: 'pending_review', label: '待审核' },
  { id: 'whitelisted', label: '已通过' },
  { id: 'rejected', label: '已拒绝' },
  { id: 'quiz_failed', label: '答题失败' },
  { id: 'rcon_failed', label: 'RCON 失败' },
];

export function AdminApp({ site }: { site: PublicSiteConfig }) {
  if (window.location.pathname === '/admin/login') {
    return <AdminLoginPage site={site} />;
  }

  if (window.location.pathname === '/admin/settings') {
    return <AdminSettingsPage />;
  }

  if (window.location.pathname === '/admin/statistics') {
    return <AdminStatisticsPage />;
  }

  if (window.location.pathname === '/admin/content') {
    return <AdminContentPage />;
  }

  if (window.location.pathname === '/admin/appearance') {
    return <AdminAppearancePage />;
  }

  if (window.location.pathname === '/admin/rcon') {
    return <AdminRconPage />;
  }

  return <AdminDashboardPage />;
}

function AdminLoginPage({ site }: { site: PublicSiteConfig }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await loginAdmin(username.trim(), password);
      window.location.href = '/admin';
    } catch (loginError) {
      setError(getMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-aside">
        <a className="admin-brand" href="/">
          <BrandMark className="admin-brand-mark" />
          <strong className="admin-brand-name">{site.name}</strong>
        </a>
        <div>
          <p className="eyebrow">CONTROL ROOM</p>
          <h1>让每一次准入，都有记录可循。</h1>
          <p>审核玩家申请、检查答题记录，并安全执行白名单操作。</p>
        </div>
        <div className="admin-login-footnote">
          <small>仅限授权管理员访问</small>
          <a
            href="https://github.com/finkkk/craft-pass"
            target="_blank"
            rel="noreferrer"
          >
            作者 finkkk · craft-pass
          </a>
        </div>
      </section>

      <section className="admin-login-panel">
        <form className="admin-login-card" onSubmit={handleSubmit}>
          <p className="eyebrow">ADMIN ACCESS</p>
          <h2>管理员登录</h2>
          <p className="admin-login-copy">
            登录状态保存在安全 Cookie 中，关闭会话后可以主动退出。
          </p>

          {error ? <div className="admin-form-error">{error}</div> : null}

          <label htmlFor="admin-username">用户名</label>
          <input
            id="admin-username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          <label htmlFor="admin-password">密码</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button
            className="primary-button full-width"
            type="submit"
            disabled={submitting}
          >
            {submitting ? '正在验证…' : '进入管理后台'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminDashboardPage() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [rconStatus, setRconStatus] = useState<RconStatus | null>(null);
  const [status, setStatus] =
    useState<ApplicationStatus>('pending_review');
  const [applications, setApplications] = useState<AdminApplicationRow[]>([]);
  const [selected, setSelected] =
    useState<AdminApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (admin) {
      void loadApplications(status);
    }
  }, [admin, status]);

  async function loadDashboard() {
    try {
      const [session, loadedSummary] = await Promise.all([
        getAdminSession(),
        getAdminSummary(),
      ]);
      setAdmin(session.admin);
      setSummary(loadedSummary);
      void refreshRconStatus();
    } catch (loadError) {
      if (loadError instanceof AdminApiError && loadError.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      setError(getMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function refreshRconStatus() {
    try {
      setRconStatus(await getRconStatus());
    } catch {
      setRconStatus({
        enabled: false,
        connected: false,
        errorMessage: '无法检测 RCON 连接状态',
        whitelistAddCommandConfigured: false,
        reloadAfterAdd: false,
        customCommandsEnabled: false,
      });
    }
  }

  async function loadApplications(nextStatus: ApplicationStatus) {
    setLoading(true);
    setError(null);
    try {
      setApplications(await getAdminApplications(nextStatus));
    } catch (loadError) {
      if (loadError instanceof AdminApiError && loadError.status === 401) {
        window.location.href = '/admin/login';
        return;
      }
      setError(getMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function openApplication(applicationId: string) {
    try {
      setSelected(await getAdminApplication(applicationId));
    } catch (loadError) {
      setError(getMessage(loadError));
    }
  }

  async function handleReviewAction(
    action: 'approve' | 'reject' | 'retry',
    reason?: string,
  ) {
    if (!selected) {
      return;
    }

    if (
      (action === 'approve' || action === 'retry') &&
      !window.confirm(
        `确认通过 RCON 为 ${selected.minecraftId} 执行白名单操作吗？`,
      )
    ) {
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      const selectedId = selected.id;

      if (action === 'approve') {
        await approveAdminApplication(selectedId);
      } else if (action === 'reject') {
        await rejectAdminApplication(selectedId, reason ?? '');
      } else {
        await retryAdminApplicationRcon(selectedId);
      }

      const [nextSummary, nextApplications, nextSelected] = await Promise.all([
        getAdminSummary(),
        getAdminApplications(status),
        action === 'reject'
          ? Promise.resolve(null)
          : getAdminApplication(selectedId),
      ]);
      setSummary(nextSummary);
      setApplications(nextApplications);
      setSelected(nextSelected);
      void refreshRconStatus();
    } catch (actionError) {
      setError(getMessage(actionError));
      await Promise.all([
        getAdminSummary().then(setSummary),
        getAdminApplications(status).then(setApplications),
        selected ? getAdminApplication(selected.id).then(setSelected) : undefined,
      ]).catch(() => undefined);
      void refreshRconStatus();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecordUpdate(input: {
    qqNumber: string;
    minecraftId: string;
  }) {
    if (!selected) {
      return false;
    }

    setActionLoading(true);
    setError(null);
    try {
      const updated = await updateAdminApplication(selected.id, input);
      setSelected(updated);
      await loadApplications(status);
      return true;
    } catch (updateError) {
      setError(getMessage(updateError));
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecordDelete() {
    if (
      !selected ||
      !window.confirm(
        `确认永久删除 ${selected.minecraftId} 的申请记录吗？此操作无法撤销。`,
      )
    ) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await deleteAdminApplication(selected.id);
      setSelected(null);
      const [nextSummary, nextApplications] = await Promise.all([
        getAdminSummary(),
        getAdminApplications(status),
      ]);
      setSummary(nextSummary);
      setApplications(nextApplications);
    } catch (deleteError) {
      setError(getMessage(deleteError));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="admin-shell">
      <AdminSidebar admin={admin} active="review" />

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">REVIEW CENTER</p>
            <h1>入服审核中心</h1>
          </div>
          <span
            className={
              rconStatus?.connected ? 'rcon-online' : 'rcon-offline'
            }
          >
            RCON {rconStatus?.connected ? '连接成功' : '不可用'}
          </span>
        </header>

        {error ? <div className="admin-form-error">{error}</div> : null}

        <section className="summary-grid">
          <SummaryCard
            label="待审核"
            value={summary?.pendingReview}
            tone="green"
          />
          <SummaryCard label="已通过" value={summary?.whitelisted} />
          <SummaryCard label="已拒绝" value={summary?.rejected} />
          <SummaryCard label="答题失败" value={summary?.quizFailed} />
          <SummaryCard
            label="RCON 异常"
            value={summary?.rconFailed}
            tone="red"
          />
        </section>

        <section className="admin-table-card">
          <div className="admin-table-heading">
            <div>
              <h2>申请记录</h2>
              <p>最多显示最近 100 条记录</p>
            </div>
            <span>{applications.length} 条</span>
          </div>

          <div className="status-tabs">
            {statusTabs.map((tab) => (
              <button
                type="button"
                className={status === tab.id ? 'active' : ''}
                key={tab.id}
                onClick={() => setStatus(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>玩家</th>
                  <th>QQ 号</th>
                  <th>分数</th>
                  <th>协议版本</th>
                  <th>提交时间</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <strong>{application.minecraftId}</strong>
                      <small>{application.ipAddress ?? '未知 IP'}</small>
                    </td>
                    <td>{application.qqNumber}</td>
                    <td>
                      <span
                        className={`score-pill ${
                          application.score >= 80 ? 'pass' : ''
                        }`}
                      >
                        {application.score}
                      </span>
                    </td>
                    <td>{application.agreementVersion}</td>
                    <td>{formatDate(application.createdAt)}</td>
                    <td>
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => void openApplication(application.id)}
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && applications.length === 0 ? (
              <div className="empty-state">
                <span>◇</span>
                当前分类下没有申请记录
              </div>
            ) : null}
            {loading ? <div className="empty-state">正在读取申请记录…</div> : null}
          </div>
        </section>
      </main>

      {selected ? (
        <ApplicationDrawer
          application={selected}
          rconEnabled={Boolean(rconStatus?.connected)}
          actionLoading={actionLoading}
          onAction={handleReviewAction}
          onUpdate={handleRecordUpdate}
          onDelete={handleRecordDelete}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = '',
}: {
  label: string;
  value?: number;
  tone?: string;
}) {
  return (
    <article className={`summary-card ${tone}`}>
      <p>{label}</p>
      <strong>{value ?? '—'}</strong>
    </article>
  );
}

function ApplicationDrawer({
  application,
  rconEnabled,
  actionLoading,
  onAction,
  onUpdate,
  onDelete,
  onClose,
}: {
  application: AdminApplicationDetail;
  rconEnabled: boolean;
  actionLoading: boolean;
  onAction: (
    action: 'approve' | 'reject' | 'retry',
    reason?: string,
  ) => Promise<void>;
  onUpdate: (input: {
    qqNumber: string;
    minecraftId: string;
  }) => Promise<boolean>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const answerRecords = application.answersJson?.answers ?? [];
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editing, setEditing] = useState(false);
  const [qqNumber, setQqNumber] = useState(application.qqNumber);
  const [minecraftId, setMinecraftId] = useState(
    application.minecraftId,
  );

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="application-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="申请详情"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">APPLICATION DETAIL</p>
            <h2>{application.minecraftId}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭详情">
            ×
          </button>
        </header>

        <dl className="drawer-details">
          <div><dt>QQ 号</dt><dd>{application.qqNumber}</dd></div>
          <div><dt>答题分数</dt><dd>{application.score} / 100</dd></div>
          <div><dt>当前状态</dt><dd>{statusLabel(application.status)}</dd></div>
          <div><dt>协议版本</dt><dd>{application.agreementVersion}</dd></div>
          <div><dt>IP 地址</dt><dd>{application.ipAddress ?? '未知'}</dd></div>
          <div><dt>签署时间</dt><dd>{formatDate(application.signedAt)}</dd></div>
        </dl>

        <section className="record-management">
          <div className="record-management-heading">
            <div>
              <h3>记录管理</h3>
              <p>修改玩家标识或永久删除这条申请。</p>
            </div>
            {!editing ? (
              <button
                className="table-action"
                type="button"
                onClick={() => setEditing(true)}
              >
                编辑
              </button>
            ) : null}
          </div>

          {editing ? (
            <form
              className="record-edit-form"
              onSubmit={(event) => {
                event.preventDefault();
                void onUpdate({
                  qqNumber: qqNumber.trim(),
                  minecraftId: minecraftId.trim(),
                }).then((saved) => {
                  if (saved) {
                    setEditing(false);
                  }
                });
              }}
            >
              <label htmlFor="record-minecraft-id">Minecraft ID</label>
              <input
                id="record-minecraft-id"
                value={minecraftId}
                pattern="[A-Za-z0-9_]{3,16}"
                maxLength={16}
                required
                onChange={(event) => setMinecraftId(event.target.value)}
              />
              <label htmlFor="record-qq-number">QQ 号</label>
              <input
                id="record-qq-number"
                value={qqNumber}
                pattern="[1-9][0-9]{4,11}"
                maxLength={12}
                required
                onChange={(event) => setQqNumber(event.target.value)}
              />
              {application.status === 'whitelisted' ? (
                <p className="rcon-warning">
                  修改已通过玩家只会更新本系统记录，不会向 Minecraft
                  服务器发送移除或新增白名单命令。
                </p>
              ) : null}
              <div>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    setQqNumber(application.qqNumber);
                    setMinecraftId(application.minecraftId);
                    setEditing(false);
                  }}
                >
                  取消
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={actionLoading}
                >
                  {actionLoading ? '正在保存…' : '保存修改'}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="answer-review">
          <h3>答题记录</h3>
          {answerRecords.map((answer, index) => (
            <div key={answer.questionId}>
              <span>{index + 1}</span>
              <p>
                <strong>
                  {answer.questionPrompt ??
                    answer.questionId.toUpperCase()}
                </strong>
                玩家选择：{answer.selectedOptionId}
                {answer.selectedOptionText
                  ? ` · ${answer.selectedOptionText}`
                  : ''}
              </p>
              <i className={answer.isCorrect ? 'correct' : 'wrong'}>
                {answer.isCorrect ? '正确' : '错误'}
              </i>
            </div>
          ))}
        </section>

        {application.rconAttempts.length > 0 ? (
          <section className="rcon-history">
            <h3>RCON 执行记录</h3>
            {application.rconAttempts.map((attempt) => (
              <article key={attempt.id}>
                <div>
                  <strong>{attempt.status}</strong>
                  <span>{formatDate(attempt.startedAt)}</span>
                </div>
                <RconAttemptOutput
                  errorMessage={attempt.errorMessage}
                  response={attempt.response}
                />
                <small>操作管理员：{attempt.admin.username}</small>
              </article>
            ))}
          </section>
        ) : null}

        {application.status === 'pending_review' ? (
          <section className="review-actions">
            {!rconEnabled ? (
              <p className="rcon-warning">
                RCON 当前不可用或连接失败，当前不能批准申请。
              </p>
            ) : null}

            {rejecting ? (
              <div className="reject-form">
                <label htmlFor="reject-reason">拒绝原因</label>
                <textarea
                  id="reject-reason"
                  maxLength={500}
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="该原因会保存在审核记录中"
                />
                <div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setRejecting(false)}
                  >
                    取消
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={!rejectReason.trim() || actionLoading}
                    onClick={() =>
                      void onAction('reject', rejectReason.trim())
                    }
                  >
                    确认拒绝
                  </button>
                </div>
              </div>
            ) : (
              <div className="review-button-row">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setRejecting(true)}
                >
                  拒绝申请
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!rconEnabled || actionLoading}
                  onClick={() => void onAction('approve')}
                >
                  {actionLoading ? '正在执行…' : '批准并加入白名单'}
                </button>
              </div>
            )}
          </section>
        ) : null}

        {application.status === 'rcon_failed' ? (
          <section className="review-actions">
            <p className="rcon-warning">
              上次 RCON 执行失败。确认服务器配置与网络后再重试。
            </p>
            <button
              className="primary-button full-width"
              type="button"
              disabled={!rconEnabled || actionLoading}
              onClick={() => void onAction('retry')}
            >
              {actionLoading ? '正在重试…' : '重试 RCON 白名单'}
            </button>
          </section>
        ) : null}

        {application.status !== 'pending_review' &&
        application.status !== 'rcon_failed' ? (
          <p className="drawer-note">该申请已经完成审核处理。</p>
        ) : null}

        <section className="record-danger-zone">
          <div>
            <strong>删除申请记录</strong>
            <p>删除后无法恢复，但管理员操作日志会保留记录快照。</p>
          </div>
          <button
            className="danger-button"
            type="button"
            disabled={actionLoading}
            onClick={() => void onDelete()}
          >
            永久删除
          </button>
        </section>
      </aside>
    </div>
  );
}

function RconAttemptOutput({
  errorMessage,
  response,
}: {
  errorMessage: string | null;
  response: string | null;
}) {
  if (errorMessage) {
    return <p>{errorMessage}</p>;
  }

  const parsed = parseRconAttemptResponse(response);

  if (!parsed) {
    return <p>{response ?? '等待服务器响应'}</p>;
  }

  return (
    <div className="rcon-output-block">
      <p>
        <span>命令</span>
        {parsed.command}
      </p>
      <p>
        <span>输出</span>
        {parsed.response || '服务器未返回文本'}
      </p>
      {parsed.reloadResponse ? (
        <p>
          <span>刷新</span>
          {parsed.reloadResponse}
        </p>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: ApplicationStatus) {
  return statusTabs.find((tab) => tab.id === status)?.label ?? status;
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

function parseRconAttemptResponse(response: string | null) {
  if (!response) {
    return null;
  }

  try {
    const parsed = JSON.parse(response) as {
      command?: unknown;
      response?: unknown;
      reloadResponse?: unknown;
    };

    if (
      typeof parsed.command !== 'string' ||
      typeof parsed.response !== 'string'
    ) {
      return null;
    }

    return {
      command: parsed.command,
      response: parsed.response,
      reloadResponse:
        typeof parsed.reloadResponse === 'string'
          ? parsed.reloadResponse
          : undefined,
    };
  } catch {
    return null;
  }
}
