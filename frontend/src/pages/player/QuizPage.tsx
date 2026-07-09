import { useState } from 'react';
import type { Quiz, UiContent } from '../../types/application';

interface QuizPageProps {
  quiz: Quiz;
  copy: UiContent['quiz'];
  initialAnswers: Record<string, string>;
  submitting: boolean;
  onBack: () => void;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
}

export function QuizPage({
  quiz,
  copy,
  initialAnswers,
  submitting,
  onBack,
  onSubmit,
}: QuizPageProps) {
  const [answers, setAnswers] =
    useState<Record<string, string>>(initialAnswers);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = quiz.questions[currentIndex];
  const selectedAnswer = currentQuestion
    ? answers[currentQuestion.id]
    : undefined;
  const isLastQuestion = currentIndex === quiz.questions.length - 1;
  const answeredCount = Object.keys(answers).length;
  const allQuestionsAnswered = answeredCount === quiz.questionCount;

  if (!currentQuestion) {
    return null;
  }

  async function handleNext() {
    if (!selectedAnswer) {
      return;
    }

    if (isLastQuestion) {
      if (!allQuestionsAnswered) {
        const firstUnansweredIndex = quiz.questions.findIndex(
          (question) => !answers[question.id],
        );
        setCurrentIndex(firstUnansweredIndex);
        return;
      }

      await onSubmit(answers);
      return;
    }

    setCurrentIndex((index) => index + 1);
  }

  return (
    <section className="quiz-layout">
      <aside className="quiz-sidebar">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>

        <div className="score-rule">
          <span>{quiz.passingScore}</span>
          <p>
            <strong>{copy.passingScoreLabel}</strong>
            {copy.fullScoreLabel}
          </p>
        </div>

        <div className="question-map" aria-label="答题进度">
          {quiz.questions.map((question, index) => (
            <button
              type="button"
              key={question.id}
              className={[
                index === currentIndex ? 'current' : '',
                answers[question.id] ? 'answered' : '',
              ].join(' ')}
              onClick={() => setCurrentIndex(index)}
              aria-label={`第 ${index + 1} 题${
                answers[question.id] ? '，已作答' : ''
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <p className="answered-count">
          {copy.answeredCountLabel}{' '}
          <strong>{answeredCount}</strong> / {quiz.questionCount}
        </p>
      </aside>

      <div className="question-card">
        <div className="question-meta">
          <span>QUESTION {String(currentIndex + 1).padStart(2, '0')}</span>
          <span>{currentIndex + 1} / {quiz.questionCount}</span>
        </div>
        <div
          className="question-progress"
          aria-label={`答题进度 ${currentIndex + 1} / ${quiz.questionCount}`}
        >
          <span
            style={{
              width: `${((currentIndex + 1) / quiz.questionCount) * 100}%`,
            }}
          />
        </div>

        <h2>{currentQuestion.prompt}</h2>

        <div className="answer-list" role="radiogroup">
          {currentQuestion.options.map((option) => {
            const selected = selectedAnswer === option.id;

            return (
              <label
                className={`answer-option ${selected ? 'selected' : ''}`}
                key={option.id}
              >
                <input
                  type="radio"
                  name={currentQuestion.id}
                  value={option.id}
                  checked={selected}
                  onChange={() =>
                    setAnswers((current) => ({
                      ...current,
                      [currentQuestion.id]: option.id,
                    }))
                  }
                />
                <span className="option-letter">{option.id}</span>
                <span>{option.text}</span>
                <i aria-hidden="true" />
              </label>
            );
          })}
        </div>

        <div className="question-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={
              currentIndex === 0
                ? onBack
                : () => setCurrentIndex((index) => index - 1)
            }
          >
            ← {currentIndex === 0 ? copy.backRulesButton : copy.previousButton}
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!selectedAnswer || submitting}
            onClick={() => void handleNext()}
          >
            {submitting
              ? copy.submittingButton
              : isLastQuestion
                ? allQuestionsAnswered
                  ? copy.submitButton
                  : copy.unansweredButton.replace(
                      '{count}',
                      String(quiz.questionCount - answeredCount),
                    )
                : copy.nextButton}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
