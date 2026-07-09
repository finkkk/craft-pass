import {
  ApplicationStatus,
  RconAttemptStatus,
} from '../generated/prisma/enums.js';
import { prisma } from '../lib/prisma.js';

const trendDays = 14;

export async function getAdminStatistics() {
  const today = startOfUtcDay(new Date());
  const trendStart = addUtcDays(today, -(trendDays - 1));
  const recent7DaysStart = addUtcDays(today, -6);

  const [
    totalApplications,
    quizPassed,
    recent7Days,
    pendingReview,
    whitelisted,
    rejected,
    quizFailed,
    rconFailed,
    rconSucceeded,
    rconAttemptFailed,
    trendApplications,
  ] = await prisma.$transaction([
    prisma.application.count(),
    prisma.application.count({ where: { passedQuiz: true } }),
    prisma.application.count({
      where: { createdAt: { gte: recent7DaysStart } },
    }),
    prisma.application.count({
      where: { status: ApplicationStatus.PENDING_REVIEW },
    }),
    prisma.application.count({
      where: { status: ApplicationStatus.WHITELISTED },
    }),
    prisma.application.count({
      where: { status: ApplicationStatus.REJECTED },
    }),
    prisma.application.count({
      where: { status: ApplicationStatus.QUIZ_FAILED },
    }),
    prisma.application.count({
      where: { status: ApplicationStatus.RCON_FAILED },
    }),
    prisma.rconAttempt.count({
      where: { status: RconAttemptStatus.SUCCEEDED },
    }),
    prisma.rconAttempt.count({
      where: { status: RconAttemptStatus.FAILED },
    }),
    prisma.application.findMany({
      where: { createdAt: { gte: trendStart } },
      select: {
        createdAt: true,
        passedQuiz: true,
      },
    }),
  ]);

  const reviewedApplications = whitelisted + rconFailed + rejected;
  const completedRconAttempts = rconSucceeded + rconAttemptFailed;
  const trendByDate = new Map<
    string,
    { submitted: number; quizPassed: number }
  >();

  for (let offset = 0; offset < trendDays; offset += 1) {
    trendByDate.set(toDateKey(addUtcDays(trendStart, offset)), {
      submitted: 0,
      quizPassed: 0,
    });
  }

  for (const application of trendApplications) {
    const entry = trendByDate.get(toDateKey(application.createdAt));

    if (entry) {
      entry.submitted += 1;
      if (application.passedQuiz) {
        entry.quizPassed += 1;
      }
    }
  }

  return {
    overview: {
      totalApplications,
      recent7Days,
      quizPassRate: toRate(quizPassed, totalApplications),
      reviewApprovalRate: toRate(
        whitelisted + rconFailed,
        reviewedApplications,
      ),
      rconSuccessRate: toRate(rconSucceeded, completedRconAttempts),
    },
    statusDistribution: {
      pendingReview,
      whitelisted,
      rejected,
      quizFailed,
      rconFailed,
    },
    rconAttempts: {
      succeeded: rconSucceeded,
      failed: rconAttemptFailed,
    },
    dailyTrend: [...trendByDate.entries()].map(([date, value]) => ({
      date,
      ...value,
    })),
    generatedAt: new Date().toISOString(),
  };
}

function toRate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 1_000) / 10;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
