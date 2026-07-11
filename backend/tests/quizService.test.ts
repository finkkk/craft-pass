import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getPublicQuizQuestions,
  quizQuestions,
} from '../src/config/quiz.js';
import { gradeQuiz } from '../src/services/quizService.js';
import {
  createQuizToken,
  QuizSelectionInvalidError,
  resolveQuizQuestionIds,
} from '../src/services/quizSelectionService.js';

function buildAnswers(correctAnswerCount: number) {
  return Object.fromEntries(
    quizQuestions.map((question, index) => {
      if (index < correctAnswerCount) {
        return [question.id, question.correctOptionId];
      }

      const wrongOption = question.options.find(
        (option) => option.id !== question.correctOptionId,
      );

      if (!wrongOption) {
        throw new Error(`题目 ${question.id} 缺少错误选项`);
      }

      return [question.id, wrongOption.id];
    }),
  );
}

test('公开题目不包含正确答案字段', () => {
  const publicQuestions = getPublicQuizQuestions();

  for (const question of publicQuestions) {
    assert.equal('correctOptionId' in question, false);
  }
});

test('答对 8 题得到 80 分并通过', () => {
  const result = gradeQuiz(buildAnswers(8));

  assert.equal(result.score, 80);
  assert.equal(result.correctCount, 8);
  assert.equal(result.passed, true);
});

test('答对 7 题得到 70 分且不通过', () => {
  const result = gradeQuiz(buildAnswers(7));

  assert.equal(result.score, 70);
  assert.equal(result.correctCount, 7);
  assert.equal(result.passed, false);
});

test('随机抽题令牌只允许提交令牌中指定的题目', () => {
  const selectedQuestions = quizQuestions.slice(0, 3);
  const answers = Object.fromEntries(
    selectedQuestions.map((question) => [question.id, question.correctOptionId]),
  );
  const token = createQuizToken(selectedQuestions.map((question) => question.id));
  const questionIds = resolveQuizQuestionIds(token, answers);
  const result = gradeQuiz(answers, questionIds);

  assert.equal(result.questionCount, 3);
  assert.equal(result.score, 100);
  assert.throws(
    () => resolveQuizQuestionIds(`${token}x`, answers),
    QuizSelectionInvalidError,
  );
});
