import { getContentConfig } from '../config/contentConfig.js';

export interface QuizAnswerResult {
  questionId: string;
  questionPrompt: string;
  selectedOptionId: string;
  selectedOptionText: string;
  isCorrect: boolean;
}

export interface QuizResult {
  score: number;
  passed: boolean;
  correctCount: number;
  questionCount: number;
  answers: QuizAnswerResult[];
}

export function gradeQuiz(answers: Readonly<Record<string, string>>): QuizResult {
  const {
    quiz: { passingScore, questions: quizQuestions },
  } = getContentConfig();
  const answerResults = quizQuestions.map((question) => {
    const selectedOptionId = answers[question.id] ?? '';
    const selectedOption = question.options.find(
      (option) => option.id === selectedOptionId,
    );

    return {
      questionId: question.id,
      questionPrompt: question.prompt,
      selectedOptionId,
      selectedOptionText: selectedOption?.text ?? '',
      isCorrect: selectedOptionId === question.correctOptionId,
    };
  });
  const correctCount = answerResults.filter((answer) => answer.isCorrect).length;
  const score = Math.round((correctCount / quizQuestions.length) * 100);

  return {
    score,
    passed: score >= passingScore,
    correctCount,
    questionCount: quizQuestions.length,
    answers: answerResults,
  };
}
