import type { Agreement, UiContent } from '../../types/application';

interface AgreementPageProps {
  agreement: Agreement;
  copy: UiContent['agreement'];
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function AgreementPage({
  agreement,
  copy,
  accepted,
  onAcceptedChange,
  onBack,
  onContinue,
}: AgreementPageProps) {
  return (
    <section className="content-card agreement-page">
      <header className="content-heading">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{agreement.title}</h1>
          <p>{copy.intro}</p>
        </div>
        <span className="version-badge">
          {copy.versionPrefix} {agreement.version}
        </span>
      </header>

      <div className="agreement-notice">
        <strong>{copy.noticeTitle}</strong>
        <p>{copy.noticeBody}</p>
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
        <h2>{copy.signatureTitle}</h2>
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
          <strong>{copy.acceptanceLabel}</strong>
        </label>
      </div>

      <div className="page-actions">
        <button className="secondary-button" type="button" onClick={onBack}>
          ← {copy.backButton}
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={!accepted}
          onClick={onContinue}
        >
          {copy.continueButton}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
