import { useState, type FormEvent } from 'react';
import type { UiContent } from '../../types/application';

interface Identity {
  qqNumber: string;
  minecraftId: string;
}

interface ApplyPageProps {
  initialValue: Identity;
  configLoading: boolean;
  submissionsEnabled: boolean;
  questionCount?: number;
  passingScore?: number;
  copy: UiContent['apply'];
  onContinue: (identity: Identity) => void;
}

export function ApplyPage({
  initialValue,
  configLoading,
  submissionsEnabled,
  questionCount,
  passingScore,
  copy,
  onContinue,
}: ApplyPageProps) {
  const [formValue, setFormValue] = useState(initialValue);
  const [errors, setErrors] = useState<Partial<Identity>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Partial<Identity> = {};

    if (!/^[1-9][0-9]{4,11}$/.test(formValue.qqNumber)) {
      nextErrors.qqNumber = copy.qqInvalidMessage;
    }

    if (!/^[A-Za-z0-9_]{3,16}$/.test(formValue.minecraftId)) {
      nextErrors.minecraftId = copy.minecraftInvalidMessage;
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      onContinue(formValue);
    }
  }

  const submitDisabled = configLoading || !submissionsEnabled;

  return (
    <section className="split-layout">
      <div className="intro-panel">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="intro-copy">{copy.intro}</p>

        <div className="feature-list">
          <div>
            <span>01</span>
            <p>
              <strong>{copy.featureOneTitle}</strong>
              {copy.featureOneDescription}
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              <strong>{copy.featureTwoTitle}</strong>
              {questionCount && passingScore
                ? copy.featureTwoConfigured
                    .replace('{count}', String(questionCount))
                    .replace('{score}', String(passingScore))
                : copy.featureTwoDescription}
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              <strong>{copy.featureThreeTitle}</strong>
              {copy.featureThreeDescription}
            </p>
          </div>
        </div>
      </div>

      <div className="form-card">
        <div className="card-heading">
          <span className="card-icon" aria-hidden="true">⌁</span>
          <div>
            <p>{copy.stepLabel}</p>
            <h2>{copy.formTitle}</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="field-label" htmlFor="qq-number">
            {copy.qqLabel}
            <span>{copy.qqHelp}</span>
          </label>
          <input
            id="qq-number"
            name="qqNumber"
            className={errors.qqNumber ? 'field-error' : ''}
            inputMode="numeric"
            autoComplete="off"
            placeholder={copy.qqPlaceholder}
            value={formValue.qqNumber}
            onChange={(event) =>
              setFormValue((current) => ({
                ...current,
                qqNumber: event.target.value.trim(),
              }))
            }
            aria-describedby={errors.qqNumber ? 'qq-error' : undefined}
          />
          {errors.qqNumber ? (
            <p className="field-message" id="qq-error">{errors.qqNumber}</p>
          ) : null}

          <label className="field-label" htmlFor="minecraft-id">
            {copy.minecraftLabel}
            <span>{copy.minecraftHelp}</span>
          </label>
          <input
            id="minecraft-id"
            name="minecraftId"
            className={errors.minecraftId ? 'field-error' : ''}
            autoComplete="off"
            placeholder={copy.minecraftPlaceholder}
            value={formValue.minecraftId}
            onChange={(event) =>
              setFormValue((current) => ({
                ...current,
                minecraftId: event.target.value.trim(),
              }))
            }
            aria-describedby={
              errors.minecraftId ? 'minecraft-id-error' : undefined
            }
          />
          {errors.minecraftId ? (
            <p className="field-message" id="minecraft-id-error">
              {errors.minecraftId}
            </p>
          ) : null}

          <button
            className="primary-button full-width"
            type="submit"
            disabled={submitDisabled}
          >
            {configLoading
              ? copy.loadingButton
              : submissionsEnabled
                ? copy.continueButton
                : '当前暂未开放申请'}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="privacy-note">
          <span aria-hidden="true">◆</span>
          {submissionsEnabled
            ? copy.privacyNote
            : '服务器当前暂停接收新的入服申请，请稍后再回来查看。'}
        </p>
      </div>
    </section>
  );
}
