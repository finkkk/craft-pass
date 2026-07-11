import { useState, type FormEvent } from 'react';
import { queryApplicationProgress } from '../../api/applications';
import type { ApplicationProgress } from '../../types/application';

const statusLabels: Record<ApplicationProgress['status'], string> = {
  quiz_failed: '答题未通过',
  pending_review: '等待管理员审核',
  rejected: '申请已拒绝',
  whitelisted: '已通过并加入白名单',
  rcon_failed: '白名单操作失败，等待管理员重试',
};

export function ProgressLookup({ onClose }: { onClose: () => void }) {
  const [qqNumber, setQqNumber] = useState('');
  const [minecraftId, setMinecraftId] = useState('');
  const [progress, setProgress] = useState<ApplicationProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      setProgress(
        await queryApplicationProgress(qqNumber.trim(), minecraftId.trim()),
      );
    } catch (lookupError) {
      setError(
        lookupError instanceof Error ? lookupError.message : '查询失败，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="progress-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="progress-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="查询申请进度"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div><p className="eyebrow">APPLICATION STATUS</p><h2>查询申请进度</h2></div>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <form onSubmit={handleSubmit}>
          <label htmlFor="progress-qq-number">QQ 号</label>
          <input
            id="progress-qq-number"
            value={qqNumber}
            inputMode="numeric"
            pattern="[1-9][0-9]{4,11}"
            maxLength={12}
            required
            onChange={(event) => setQqNumber(event.target.value.trim())}
          />
          <label htmlFor="progress-minecraft-id">Minecraft ID</label>
          <input
            id="progress-minecraft-id"
            value={minecraftId}
            pattern="[A-Za-z0-9_]{3,16}"
            maxLength={16}
            required
            onChange={(event) => setMinecraftId(event.target.value)}
          />
          <button className="primary-button full-width" disabled={loading}>
            {loading ? '正在查询…' : '查询进度'}
          </button>
        </form>
        {error ? <div className="admin-form-error">{error}</div> : null}
        {progress ? (
          <article className={`progress-result ${progress.status}`}>
            <small>{progress.minecraftId}</small>
            <strong>{statusLabels[progress.status]}</strong>
            <p>答题分数：{progress.score} / 100</p>
            {progress.status === 'rejected' ? (
              <div><span>拒绝原因</span><p>{progress.rejectReason || '管理员未填写拒绝原因'}</p></div>
            ) : null}
            <time>提交于 {new Date(progress.submittedAt).toLocaleString('zh-CN')}</time>
          </article>
        ) : null}
      </section>
    </div>
  );
}
