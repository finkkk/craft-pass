import { useEffect, useMemo, useState } from 'react';
import {
  AdminApiError,
  getAdminSession,
  getAdminStatistics,
} from '../../api/admin';
import type {
  AdminIdentity,
  AdminStatistics,
} from '../../types/admin';
import { AdminSidebar } from './AdminSidebar';

const statusRows = [
  { key: 'pendingReview', label: '待审核', tone: 'amber' },
  { key: 'whitelisted', label: '已通过', tone: 'green' },
  { key: 'rejected', label: '已拒绝', tone: 'red' },
  { key: 'quizFailed', label: '答题失败', tone: 'gray' },
  { key: 'rconFailed', label: 'RCON 失败', tone: 'orange' },
] as const;

export function AdminStatisticsPage() {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [statistics, setStatistics] = useState<AdminStatistics | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAdminSession(), getAdminStatistics()])
      .then(([session, loadedStatistics]) => {
        setAdmin(session.admin);
        setStatistics(loadedStatistics);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof AdminApiError && loadError.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        setError(getMessage(loadError));
      });
  }, []);

  const maxDailyApplications = useMemo(
    () =>
      Math.max(
        1,
        ...(statistics?.dailyTrend.map((day) => day.submitted) ?? []),
      ),
    [statistics],
  );

  return (
    <div className="admin-shell">
      <AdminSidebar admin={admin} active="statistics" />

      <main className="admin-main statistics-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">DATA OVERVIEW</p>
            <h1>数据统计</h1>
          </div>
          <span className="rcon-online">最近 14 天趋势</span>
        </header>

        {error ? <div className="admin-form-error">{error}</div> : null}

        {!statistics ? (
          <div className="settings-loading">正在汇总申请数据…</div>
        ) : (
          <>
            <section className="statistics-kpis">
              <StatisticCard
                label="累计申请"
                value={String(statistics.overview.totalApplications)}
                note={`近 7 天新增 ${statistics.overview.recent7Days} 条`}
              />
              <StatisticCard
                label="答题通过率"
                value={formatRate(statistics.overview.quizPassRate)}
                note="按全部申请计算"
              />
              <StatisticCard
                label="审核通过率"
                value={formatRate(
                  statistics.overview.reviewApprovalRate,
                )}
                note="仅统计已作出决定的申请"
              />
              <StatisticCard
                label="RCON 成功率"
                value={formatRate(statistics.overview.rconSuccessRate)}
                note={
                  statistics.overview.rconSuccessRate === null
                    ? '尚无已完成的 RCON 尝试'
                    : `${statistics.rconAttempts.succeeded} 成功 / ${statistics.rconAttempts.failed} 失败`
                }
              />
            </section>

            <section className="statistics-layout">
              <article className="statistics-panel trend-panel">
                <header>
                  <div>
                    <p className="eyebrow">APPLICATION TREND</p>
                    <h2>每日申请趋势</h2>
                  </div>
                  <span>深色：通过答题</span>
                </header>
                <div className="trend-chart">
                  {statistics.dailyTrend.map((day) => (
                    <div className="trend-column" key={day.date}>
                      <div className="trend-value">
                        {day.submitted > 0 ? day.submitted : ''}
                      </div>
                      <div className="trend-track">
                        <div
                          className="trend-bar submitted"
                          style={{
                            height: `${Math.max(
                              day.submitted > 0 ? 8 : 0,
                              (day.submitted / maxDailyApplications) * 100,
                            )}%`,
                          }}
                        >
                          <div
                            className="trend-bar passed"
                            style={{
                              height:
                                day.submitted === 0
                                  ? '0%'
                                  : `${(day.quizPassed / day.submitted) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <time dateTime={day.date}>
                        {day.date.slice(5).replace('-', '/')}
                      </time>
                    </div>
                  ))}
                </div>
              </article>

              <article className="statistics-panel distribution-panel">
                <header>
                  <div>
                    <p className="eyebrow">STATUS MIX</p>
                    <h2>状态分布</h2>
                  </div>
                </header>
                <div className="distribution-list">
                  {statusRows.map((row) => {
                    const value = statistics.statusDistribution[row.key];
                    const percentage =
                      statistics.overview.totalApplications === 0
                        ? 0
                        : (value /
                            statistics.overview.totalApplications) *
                          100;

                    return (
                      <div key={row.key}>
                        <p>
                          <span>{row.label}</span>
                          <strong>{value}</strong>
                        </p>
                        <div>
                          <i
                            className={row.tone}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>

            <p className="statistics-generated">
              数据生成时间：
              {new Intl.DateTimeFormat('zh-CN', {
                dateStyle: 'medium',
                timeStyle: 'medium',
              }).format(new Date(statistics.generatedAt))}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function StatisticCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function formatRate(value: number | null) {
  return value === null ? '暂无' : `${value.toFixed(1)}%`;
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : '无法读取统计数据';
}
