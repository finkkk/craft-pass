import { useEffect, useState } from 'react';
import {
  getAgreement,
  getQuiz,
  submitApplication,
} from '../../api/applications';
import { StepIndicator } from '../../components/StepIndicator';
import { AgreementPage } from './AgreementPage';
import { ApplyPage } from './ApplyPage';
import { QuizPage } from './QuizPage';
import { ResultPage } from './ResultPage';
import type {
  Agreement,
  ApplicationResult,
  Quiz,
} from '../../types/application';
import type { PublicSiteConfig } from '../../types/setup';
import { BrandMark } from '../../components/BrandMark';

type PlayerStep = 'identity' | 'agreement' | 'quiz' | 'result';

interface Identity {
  qqNumber: string;
  minecraftId: string;
}

export function PlayerApp({ site }: { site: PublicSiteConfig }) {
  const [step, setStep] = useState<PlayerStep>('identity');
  const [identity, setIdentity] = useState<Identity>({
    qqNumber: '',
    minecraftId: '',
  });
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ApplicationResult | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadApplicationConfig() {
      try {
        const [loadedAgreement, loadedQuiz] = await Promise.all([
          getAgreement(),
          getQuiz(),
        ]);

        if (!cancelled) {
          setAgreement(loadedAgreement);
          setQuiz(loadedQuiz);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoadingConfig(false);
        }
      }
    }

    void loadApplicationConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  function continueToAgreement(nextIdentity: Identity) {
    if (!agreement) {
      setErrorMessage('协议尚未加载完成，请稍后再试。');
      return;
    }

    setIdentity(nextIdentity);
    setErrorMessage(null);
    setStep('agreement');
  }

  function continueToQuiz() {
    if (!quiz || !agreement) {
      setErrorMessage('题目尚未加载完成，请稍后再试。');
      return;
    }

    setErrorMessage(null);
    setStep('quiz');
  }

  async function handleSubmit(finalAnswers: Record<string, string>) {
    if (!agreement) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const applicationResult = await submitApplication({
        ...identity,
        agreementVersion: agreement.version,
        agreementAccepted,
        answers: finalAnswers,
      });

      setAnswers(finalAnswers);
      setResult(applicationResult);
      setStep('result');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function restartFromAgreement() {
    setAgreementAccepted(false);
    setAnswers({});
    setResult(null);
    setErrorMessage(null);
    setStep('agreement');
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Craft Pass 首页">
          <BrandMark />
          <span>
            <strong>{site.name.toUpperCase()}</strong>
            <small>{site.subtitle}</small>
          </span>
        </a>
        <span className="system-status">
          <i aria-hidden="true" />
          审核系统在线
        </span>
      </header>

      <main className="page-frame">
        <StepIndicator currentStep={step} />

        {errorMessage ? (
          <div className="error-banner" role="alert">
            <span aria-hidden="true">!</span>
            <p>{errorMessage}</p>
            <button type="button" onClick={() => setErrorMessage(null)}>
              关闭
            </button>
          </div>
        ) : null}

        {step === 'identity' ? (
          <ApplyPage
            initialValue={identity}
            configLoading={loadingConfig}
            questionCount={quiz?.questionCount}
            passingScore={quiz?.passingScore}
            onContinue={continueToAgreement}
          />
        ) : null}

        {step === 'agreement' && agreement ? (
          <AgreementPage
            agreement={agreement}
            accepted={agreementAccepted}
            onAcceptedChange={setAgreementAccepted}
            onBack={() => setStep('identity')}
            onContinue={continueToQuiz}
          />
        ) : null}

        {step === 'quiz' && quiz ? (
          <QuizPage
            quiz={quiz}
            initialAnswers={answers}
            submitting={submitting}
            onBack={() => setStep('agreement')}
            onSubmit={handleSubmit}
          />
        ) : null}

        {step === 'result' && result ? (
          <ResultPage
            result={result}
            onReadAgain={restartFromAgreement}
          />
        ) : null}
      </main>

      <footer className="site-footer">
        <p>Craft Pass · 公平、友善、长期生存</p>
        <p>请勿在公共场合分享答题内容</p>
      </footer>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '请求失败，请确认后端服务正常运行后重试。';
}
