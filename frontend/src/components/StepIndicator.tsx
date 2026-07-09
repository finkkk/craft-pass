import type { UiContent } from '../types/application';

interface StepIndicatorProps {
  currentStep: 'identity' | 'agreement' | 'quiz' | 'result';
  labels: UiContent['navigation'];
}

export function StepIndicator({ currentStep, labels }: StepIndicatorProps) {
  const steps = [
    { id: 'identity', label: labels.stepIdentity },
    { id: 'agreement', label: labels.stepAgreement },
    { id: 'quiz', label: labels.stepQuiz },
    { id: 'result', label: labels.stepResult },
  ] as const;
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <nav className="step-indicator" aria-label="申请进度">
      {steps.map((step, index) => {
        const state =
          index < currentIndex
            ? 'complete'
            : index === currentIndex
              ? 'current'
              : 'upcoming';

        return (
          <div className={`step-item ${state}`} key={step.id}>
            <span className="step-number">
              {state === 'complete' ? '✓' : index + 1}
            </span>
            <span className="step-label">{step.label}</span>
            {index < steps.length - 1 ? (
              <span className="step-line" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
