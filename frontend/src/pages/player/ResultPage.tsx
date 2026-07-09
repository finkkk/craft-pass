import type { ApplicationResult } from '../../types/application';

interface ResultPageProps {
  result: ApplicationResult;
  onReadAgain: () => void;
}

export function ResultPage({ result, onReadAgain }: ResultPageProps) {
  const passed = result.passed;

  return (
    <section className={`result-card ${passed ? 'passed' : 'failed'}`}>
      <div className="result-symbol" aria-hidden="true">
        {passed ? '✓' : '×'}
      </div>
      <p className="eyebrow">APPLICATION RESULT</p>
      <h1>{passed ? '申请已进入审核队列' : '本次测试未通过'}</h1>
      <p className="result-lead">
        {passed
          ? '你已完成规则签署与测试。管理员审核通过后，会将你的 Minecraft ID 加入白名单。'
          : `你的分数未达到合格线，请重新阅读规则后再次尝试。系统不会显示具体错题答案。`}
      </p>

      <div className="score-display">
        <strong>{result.score}</strong>
        <span>/ 100</span>
      </div>

      <dl className="result-details">
        <div>
          <dt>Minecraft ID</dt>
          <dd>{result.minecraftId}</dd>
        </div>
        <div>
          <dt>QQ 号</dt>
          <dd>{result.qqNumber}</dd>
        </div>
        <div>
          <dt>申请状态</dt>
          <dd>{passed ? '等待管理员审核' : '答题未通过'}</dd>
        </div>
        <div>
          <dt>申请编号</dt>
          <dd className="application-id">{result.applicationId}</dd>
        </div>
      </dl>

      {passed ? (
        <div className="result-notice">
          <span aria-hidden="true">i</span>
          请妥善保存申请编号，无需重复提交。审核期间可留意管理员的 QQ 消息。
        </div>
      ) : (
        <button
          className="primary-button"
          type="button"
          onClick={onReadAgain}
        >
          重新阅读服务器规则
          <span aria-hidden="true">↻</span>
        </button>
      )}
    </section>
  );
}
