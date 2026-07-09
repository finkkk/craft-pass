import type { Agreement } from '../../types/application';

interface AgreementPageProps {
  agreement: Agreement;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function AgreementPage({
  agreement,
  accepted,
  onAcceptedChange,
  onBack,
  onContinue,
}: AgreementPageProps) {
  return (
    <section className="content-card agreement-page">
      <header className="content-heading">
        <div>
          <p className="eyebrow">STEP 02 · AGREEMENT</p>
          <h1>{agreement.title}</h1>
          <p>请完整阅读以下内容。规则不是装饰，而是我们共同维护世界的约定。</p>
        </div>
        <span className="version-badge">版本 {agreement.version}</span>
      </header>

      <div className="agreement-notice">
        <strong>阅读提示</strong>
        <p>答题内容全部来自以下规则。正式提交后，签署版本与时间将被保存。</p>
      </div>

      <div className="rules-list">
        {agreement.sections.map((section, index) => (
          <article className="rule-section" key={section.id}>
            <span className="rule-index">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="signature-box">
        <h2>签署确认</h2>
        <ul>
          {agreement.signatureStatements.map((statement) => (
            <li key={statement}>{statement}</li>
          ))}
        </ul>
        <label className="check-row">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => onAcceptedChange(event.target.checked)}
          />
          <span aria-hidden="true" />
          <strong>我已完整阅读并同意遵守以上服务器规则</strong>
        </label>
      </div>

      <div className="page-actions">
        <button className="secondary-button" type="button" onClick={onBack}>
          ← 返回修改资料
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!accepted}
          onClick={onContinue}
        >
          开始规则测试
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
