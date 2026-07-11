import { useEffect, useState } from 'react';
import {
  checkApplicationIdentity,
  getAgreement,
  getQuiz,
  submitApplication,
} from '../../api/applications';
import { StepIndicator } from '../../components/StepIndicator';
import { AgreementPage } from './AgreementPage';
import { ApplyPage } from './ApplyPage';
import { QuizPage } from './QuizPage';
import { ResultPage } from './ResultPage';
import { ProgressLookup } from './ProgressLookup';
import type {
  Agreement,
  ApplicationResult,
  Quiz,
  UiContent,
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
  const [ui, setUi] = useState<UiContent | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [submissionsEnabled, setSubmissionsEnabled] = useState(true);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ApplicationResult | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadApplicationConfig() {
      try {
        const [loadedContent, loadedQuiz] = await Promise.all([
          getAgreement(),
          getQuiz(),
        ]);

        if (!cancelled) {
          setAgreement(loadedContent.agreement);
          setUi(loadedContent.ui);
          setSubmissionsEnabled(loadedContent.application.submissionsEnabled);
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

  async function continueToAgreement(nextIdentity: Identity) {
    if (!agreement) {
      setErrorMessage('协议尚未加载完成，请稍后再试。');
      return;
    }

    try {
      await checkApplicationIdentity(
        nextIdentity.qqNumber,
        nextIdentity.minecraftId,
      );
      setIdentity(nextIdentity);
      setErrorMessage(null);
      setStep('agreement');
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      window.alert(message);
    }
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
        quizToken: quiz?.quizToken,
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
        <a className="brand" href="/" aria-label={`${site.name} 首页`}>
          <BrandMark />
          <span>
            <strong>{site.name.toUpperCase()}</strong>
            <small>{site.subtitle}</small>
          </span>
        </a>
        <div className="site-header-actions">
          <button type="button" onClick={() => setProgressOpen(true)}>
            查询申请进度
          </button>
          <span className="system-status">
            <i aria-hidden="true" />
            {ui?.navigation.systemStatus ?? '审核系统在线'}
          </span>
        </div>
      </header>

      <main className="page-frame">
        {ui ? (
          <StepIndicator currentStep={step} labels={ui.navigation} />
        ) : null}

        {errorMessage ? (
          <div className="error-banner" role="alert">
            <span aria-hidden="true">!</span>
            <p>{errorMessage}</p>
            <button type="button" onClick={() => setErrorMessage(null)}>
              关闭
            </button>
          </div>
        ) : null}

        {step === 'identity' && ui ? (
          <ApplyPage
            initialValue={identity}
            configLoading={loadingConfig}
            submissionsEnabled={submissionsEnabled}
            questionCount={quiz?.questionCount}
            passingScore={quiz?.passingScore}
            copy={ui.apply}
            onContinue={continueToAgreement}
          />
        ) : null}

        {step === 'agreement' && agreement && ui ? (
          <AgreementPage
            agreement={agreement}
            copy={ui.agreement}
            accepted={agreementAccepted}
            onAcceptedChange={setAgreementAccepted}
            onBack={() => setStep('identity')}
            onContinue={continueToQuiz}
          />
        ) : null}

        {step === 'quiz' && quiz && ui ? (
          <QuizPage
            quiz={quiz}
            copy={ui.quiz}
            initialAnswers={answers}
            submitting={submitting}
            onBack={() => setStep('agreement')}
            onSubmit={handleSubmit}
          />
        ) : null}

        {step === 'result' && result && ui ? (
          <ResultPage
            result={result}
            copy={ui.result}
            onReadAgain={restartFromAgreement}
          />
        ) : null}
      </main>

      <footer className="site-footer">
        <p>{ui?.navigation.footerPrimary ?? site.name}</p>
        <p>{ui?.navigation.footerSecondary ?? site.subtitle}</p>
        <p className="project-credit">
          作者 finkkk ·{' '}
          <a
            href="https://github.com/finkkk/craft-pass"
            target="_blank"
            rel="noreferrer"
          >
            finkkk/craft-pass
          </a>
        </p>
      </footer>

      {progressOpen ? (
        <ProgressLookup onClose={() => setProgressOpen(false)} />
      ) : null}
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '请求失败，请确认后端服务正常运行后重试。';
}
