interface StepIndicatorProps {
  currentStep: 'identity' | 'agreement' | 'quiz' | 'result';
}

const steps = [
  { id: 'identity', label: '填写资料' },
  { id: 'agreement', label: '阅读规则' },
  { id: 'quiz', label: '规则测试' },
  { id: 'result', label: '提交结果' },
] as const;

export function StepIndicator({ currentStep }: StepIndicatorProps) {
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
