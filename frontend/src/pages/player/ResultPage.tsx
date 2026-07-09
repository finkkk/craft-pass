import type { ApplicationResult, UiContent } from '../../types/application';

interface ResultPageProps {
  result: ApplicationResult;
  copy: UiContent['result'];
  onReadAgain: () => void;
}

export function ResultPage({ result, copy, onReadAgain }: ResultPageProps) {
  const passed = result.passed;

  return (
    <section className={`result-card ${passed ? 'passed' : 'failed'}`}>
      <div className="result-symbol" aria-hidden="true">
        {passed ? '✓' : '×'}
      </div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{passed ? copy.passedTitle : copy.failedTitle}</h1>
      <p className="result-lead">
        {passed ? copy.passedDescription : copy.failedDescription}
      </p>

      <div className="score-display">
        <strong>{result.score}</strong>
        <span>/ 100</span>
      </div>

      <dl className="result-details">
        <div>
          <dt>{copy.minecraftLabel}</dt>
          <dd>{result.minecraftId}</dd>
        </div>
        <div>
          <dt>{copy.qqLabel}</dt>
          <dd>{result.qqNumber}</dd>
        </div>
        <div>
          <dt>{copy.statusLabel}</dt>
          <dd>{passed ? copy.pendingStatus : copy.failedStatus}</dd>
        </div>
        <div>
          <dt>{copy.applicationIdLabel}</dt>
          <dd className="application-id">{result.applicationId}</dd>
        </div>
      </dl>

      {passed ? (
        <div className="result-notice">
          <span aria-hidden="true">i</span>
          {copy.notice}
        </div>
      ) : (
        <button
          className="primary-button"
          type="button"
          onClick={onReadAgain}
        >
          {copy.retryButton}
          <span aria-hidden="true">↻</span>
        </button>
      )}
    </section>
  );
}
