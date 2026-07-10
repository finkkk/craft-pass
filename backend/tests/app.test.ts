import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { agreement } from '../src/config/agreement.js';
import { quizQuestions } from '../src/config/quiz.js';
import { ApplicationStatus } from '../src/generated/prisma/enums.js';
import { prisma } from '../src/lib/prisma.js';
import {
  approveApplication,
  retryApplicationRcon,
  ReviewOperationError,
} from '../src/services/reviewService.js';
import type { RconExecutor } from '../src/services/rconService.js';

let server: Server;
let baseUrl: string;
let adminCookie: string;
let adminId: string;
let pendingApplicationId: string;

before(async () => {
  server = createApp().listen(0);

  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('测试服务未能获得本地端口');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test('健康检查返回服务状态与安全响应头', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: 'http://localhost:5173',
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.service, 'craft-pass-backend');
  assert.equal(body.status, 'ok');
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:5173',
  );
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('x-request-id') ?? '', /^[\da-f-]{36}$/);
});

test('首次部署必须使用控制台令牌，完成后入口自动锁定', async () => {
  const initialStatusResponse = await fetch(`${baseUrl}/api/setup/status`);
  const initialStatus = await initialStatusResponse.json();

  assert.equal(initialStatus.setupRequired, true);

  const payload = {
    setupToken: 'wrong-setup-token-123456',
    siteName: 'Craft Pass Test',
    siteSubtitle: '测试服务器入服审核',
    admin: {
      username: 'test_admin',
      password: 'admin123',
    },
    rcon: {
      enabled: false,
      host: '127.0.0.1',
      port: 25575,
      password: '',
      timeoutMs: 5000,
      whitelistAddCommand: 'whitelist add {minecraftId}',
      whitelistReloadCommand: '',
    },
  };
  const invalidResponse = await fetch(`${baseUrl}/api/setup/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(invalidResponse.status, 403);

  const weakPasswordResponse = await fetch(
    `${baseUrl}/api/setup/complete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        setupToken: 'test-setup-token-1234567890',
        admin: {
          ...payload.admin,
          password: 'abcdefgh',
        },
      }),
    },
  );
  const weakPasswordBody = await weakPasswordResponse.json();
  assert.equal(weakPasswordResponse.status, 400);
  assert.equal(weakPasswordBody.error.code, 'VALIDATION_ERROR');

  const response = await fetch(`${baseUrl}/api/setup/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
    },
    body: JSON.stringify({
      ...payload,
      setupToken: 'test-setup-token-1234567890',
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.setupCompleted, true);
  assert.equal(body.admin.username, 'test_admin');

  const completedStatusResponse = await fetch(
    `${baseUrl}/api/setup/status`,
  );
  const completedStatus = await completedStatusResponse.json();
  assert.equal(completedStatus.setupRequired, false);

  const repeatedResponse = await fetch(`${baseUrl}/api/setup/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      setupToken: 'test-setup-token-1234567890',
    }),
  });
  assert.equal(repeatedResponse.status, 409);
});

test('不存在的接口返回统一 404 错误', async () => {
  const response = await fetch(`${baseUrl}/api/missing`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'ROUTE_NOT_FOUND');
  assert.equal(body.error.requestId, response.headers.get('x-request-id'));
});

test('非法 JSON 返回统一 400 错误', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{',
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'INVALID_JSON');
});

test('未授权的网页来源被 CORS 拒绝', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: {
      Origin: 'https://not-allowed.example',
    },
  });
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'CORS_ORIGIN_DENIED');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('协议接口返回当前版本和签署声明', async () => {
  const response = await fetch(`${baseUrl}/api/agreement`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.agreement.version, agreement.version);
  assert.ok(body.agreement.sections.length > 0);
  assert.ok(body.agreement.signatureStatements.length > 0);
  assert.equal(body.ui.agreement.continueButton, '开始规则测试');
  assert.equal(body.ui.navigation.stepAgreement, '阅读规则');
});

test('题目接口不泄露正确答案', async () => {
  const response = await fetch(`${baseUrl}/api/quiz`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.questionCount, 10);
  assert.equal(body.passingScore, 80);

  for (const question of body.questions) {
    assert.equal('correctOptionId' in question, false);
  }
});

test('格式错误或漏答的申请返回字段错误', async () => {
  const response = await postApplication({
    qqNumber: '0123',
    minecraftId: 'x',
    agreementVersion: agreement.version,
    agreementAccepted: false,
    answers: {},
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.fieldErrors.qqNumber.length > 0);
  assert.ok(body.error.details.fieldErrors.answers.length > 0);
});

test('旧协议版本申请会被拒绝并返回当前版本', async () => {
  const response = await postApplication({
    ...buildValidApplicationPayload('OutdatedPlayer'),
    agreementVersion: 'old-version',
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error.code, 'AGREEMENT_VERSION_OUTDATED');
  assert.equal(body.error.details.currentVersion, agreement.version);
});

test('答题失败会写入记录，但不会返回正确答案', async () => {
  const payload = buildValidApplicationPayload('FailedPlayer');
  payload.answers = buildAnswers(0);

  const response = await postApplication(payload);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.status, 'quiz_failed');
  assert.equal(body.score, 0);
  assert.equal(body.passed, false);
  assert.equal('answers' in body, false);

  const storedApplication = await prisma.application.findUnique({
    where: {
      id: body.applicationId,
    },
  });

  assert.equal(storedApplication?.passedQuiz, false);
  assert.equal(storedApplication?.status, ApplicationStatus.QUIZ_FAILED);
});

test('满分申请进入待审核，活跃申请不能重复提交', async () => {
  const payload = buildValidApplicationPayload('PendingPlayer');
  const firstResponse = await postApplication(payload);
  const firstBody = await firstResponse.json();

  assert.equal(firstResponse.status, 201);
  assert.equal(firstBody.status, 'pending_review');
  assert.equal(firstBody.score, 100);
  assert.equal(firstBody.passed, true);
  pendingApplicationId = firstBody.applicationId;

  const duplicateResponse = await postApplication(payload);
  const duplicateBody = await duplicateResponse.json();

  assert.equal(duplicateResponse.status, 409);
  assert.equal(duplicateBody.error.code, 'ACTIVE_APPLICATION_EXISTS');
  assert.equal(
    duplicateBody.error.details.currentStatus,
    'pending_review',
  );
});

test('未登录不能访问管理员接口', async () => {
  const response = await fetch(`${baseUrl}/api/admin/summary`);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'ADMIN_AUTH_REQUIRED');
});

test('管理员使用 bcrypt 密码登录并获得安全 Cookie', async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'test_admin',
      password: 'wrong-password',
    }),
  });
  assert.equal(invalidResponse.status, 401);

  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'test_admin',
      password: 'admin123',
    }),
  });
  const body = await response.json();
  const setCookie = response.headers.get('set-cookie') ?? '';

  assert.equal(response.status, 200);
  assert.equal(body.admin.username, 'test_admin');
  adminId = body.admin.id;
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);

  adminCookie = setCookie.split(';')[0] ?? '';
  assert.ok(adminCookie.startsWith('craft_pass_admin_session='));
});

test('登录后可以读取概览、待审核列表与申请详情', async () => {
  const headers = {
    Cookie: adminCookie,
  };
  const sessionResponse = await fetch(`${baseUrl}/api/admin/session`, {
    headers,
  });
  const sessionBody = await sessionResponse.json();

  assert.equal(sessionResponse.status, 200);
  assert.equal(sessionBody.admin.username, 'test_admin');

  const summaryResponse = await fetch(`${baseUrl}/api/admin/summary`, {
    headers,
  });
  const summary = await summaryResponse.json();

  assert.equal(summaryResponse.status, 200);
  assert.equal(summary.pendingReview, 1);
  assert.equal(summary.quizFailed, 1);

  const listResponse = await fetch(
    `${baseUrl}/api/admin/applications?status=pending_review`,
    { headers },
  );
  const listBody = await listResponse.json();

  assert.equal(listResponse.status, 200);
  assert.equal(listBody.applications.length, 1);
  assert.equal(listBody.applications[0].minecraftId, 'PendingPlayer');

  const detailResponse = await fetch(
    `${baseUrl}/api/admin/applications/${listBody.applications[0].id}`,
    { headers },
  );
  const detailBody = await detailResponse.json();

  assert.equal(detailResponse.status, 200);
  assert.equal(detailBody.application.status, 'pending_review');
  assert.ok(detailBody.application.answersJson);
  assert.equal(
    detailBody.application.answersJson.answers[0].questionPrompt,
    quizQuestions[0]?.prompt,
  );
});

test('管理员可以更新站点与 RCON 配置且密码不会回显', async () => {
  const headers = {
    Cookie: adminCookie,
  };
  const initialResponse = await fetch(`${baseUrl}/api/admin/settings`, {
    headers,
  });
  const initial = await initialResponse.json();

  assert.equal(initialResponse.status, 200);
  assert.equal(initial.site.name, 'Craft Pass Test');
  assert.equal(initial.application.submissionsEnabled, true);
  assert.equal(initial.rcon.customCommandsEnabled, true);
  assert.equal('password' in initial.rcon, false);

  const invalidResponse = await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site: {
        name: 'Updated Craft Pass',
        subtitle: '更新后的测试站点',
      },
      application: initial.application,
      rcon: {
        ...initial.rcon,
        enabled: true,
        host: '127.0.0.1',
        port: 25575,
        timeoutMs: 5000,
        whitelistAddCommand: 'whitelist add {minecraftId}',
        whitelistReloadCommand: '',
      },
    }),
  });
  assert.equal(invalidResponse.status, 400);

  const response = await fetch(`${baseUrl}/api/admin/settings`, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site: {
        name: 'Updated Craft Pass',
        subtitle: '更新后的测试站点',
      },
      application: {
        ...initial.application,
        maxSubmissionsPerQq: 15,
      },
      rcon: {
        enabled: false,
        host: '192.0.2.10',
        port: 25575,
        password: '',
        timeoutMs: 6000,
        whitelistAddCommand: 'whitelist add {minecraftId}',
        whitelistReloadCommand: 'whitelist reload',
        customCommandsEnabled: true,
        blockedCommands: ['stop', 'op'],
      },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.site.name, 'Updated Craft Pass');
  assert.equal(body.application.maxSubmissionsPerQq, 15);
  assert.equal(body.rcon.host, '192.0.2.10');
  assert.deepEqual(body.rcon.blockedCommands, ['stop', 'op']);
  assert.equal(body.rcon.reloadAfterAdd, undefined);
  assert.equal('password' in body.rcon, false);

  const publicResponse = await fetch(`${baseUrl}/api/site-config`);
  const publicConfig = await publicResponse.json();
  assert.equal(publicConfig.name, 'Updated Craft Pass');
});

test('系统配置可以控制申请入口、失败冷却和提交频率', async () => {
  const headers = {
    Cookie: adminCookie,
    'Content-Type': 'application/json',
  };
  const settingsResponse = await fetch(`${baseUrl}/api/admin/settings`, {
    headers,
  });
  const originalSettings = await settingsResponse.json();
  const createdApplicationIds: string[] = [];

  async function saveSettings(
    application: typeof originalSettings.application,
  ) {
    const response = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        site: originalSettings.site,
        application,
        rcon: {
          enabled: originalSettings.rcon.enabled,
          host: originalSettings.rcon.host,
          port: originalSettings.rcon.port,
          password: '',
          timeoutMs: originalSettings.rcon.timeoutMs,
          whitelistAddCommand: originalSettings.rcon.whitelistAddCommand,
          whitelistReloadCommand:
            originalSettings.rcon.whitelistReloadCommand,
          customCommandsEnabled:
            originalSettings.rcon.customCommandsEnabled,
          blockedCommands: originalSettings.rcon.blockedCommands,
        },
      }),
    });

    assert.equal(response.status, 200);
  }

  try {
    await saveSettings({
      ...originalSettings.application,
      submissionsEnabled: false,
    });
    const disabledResponse = await postApplication(
      buildValidApplicationPayload('ClosedEntry'),
    );
    const disabledBody = await disabledResponse.json();
    assert.equal(disabledResponse.status, 503);
    assert.equal(
      disabledBody.error.code,
      'APPLICATION_SUBMISSIONS_DISABLED',
    );

    await saveSettings({
      ...originalSettings.application,
      submissionsEnabled: true,
      quizFailCooldownMinutes: 60,
      maxSubmissionsPerQq: 20,
      maxSubmissionsPerMinecraftId: 20,
    });
    const failedPayload = {
      ...buildValidApplicationPayload('CooldownFail'),
      qqNumber: '423456789',
      answers: buildAnswers(0),
    };
    const failedResponse = await postApplication(failedPayload);
    const failedBody = await failedResponse.json();
    createdApplicationIds.push(failedBody.applicationId);
    assert.equal(failedResponse.status, 201);

    const cooldownResponse = await postApplication({
      ...buildValidApplicationPayload('CooldownRetry'),
      qqNumber: '423456789',
    });
    const cooldownBody = await cooldownResponse.json();
    assert.equal(cooldownResponse.status, 429);
    assert.equal(cooldownBody.error.code, 'APPLICATION_COOLDOWN_ACTIVE');
    assert.match(cooldownBody.error.details.retryAt, /^\d{4}-/);

    await saveSettings({
      ...originalSettings.application,
      submissionsEnabled: true,
      quizFailCooldownMinutes: 0,
      rateLimitWindowMinutes: 60,
      maxSubmissionsPerQq: 1,
      maxSubmissionsPerMinecraftId: 20,
    });
    const rateLimitedFirstResponse = await postApplication({
      ...buildValidApplicationPayload('RateLimitOne'),
      qqNumber: '523456789',
    });
    const rateLimitedFirstBody = await rateLimitedFirstResponse.json();
    createdApplicationIds.push(rateLimitedFirstBody.applicationId);
    assert.equal(rateLimitedFirstResponse.status, 201);

    const rateLimitedSecondResponse = await postApplication({
      ...buildValidApplicationPayload('RateLimitTwo'),
      qqNumber: '523456789',
    });
    const rateLimitedSecondBody = await rateLimitedSecondResponse.json();
    assert.equal(rateLimitedSecondResponse.status, 429);
    assert.equal(
      rateLimitedSecondBody.error.code,
      'APPLICATION_RATE_LIMIT_ACTIVE',
    );
    assert.equal(rateLimitedSecondBody.error.details.dimension, 'QQ 号');
  } finally {
    await saveSettings(originalSettings.application);
    await prisma.application.deleteMany({
      where: {
        id: { in: createdApplicationIds.filter(Boolean) },
      },
    });
  }
});

test('管理员可以上传和移除站点 Logo，公开接口只返回安全图片', async () => {
  const headers = {
    Cookie: adminCookie,
    'Content-Type': 'application/json',
  };
  const initialResponse = await fetch(`${baseUrl}/api/admin/logo`, {
    headers,
  });
  const initial = await initialResponse.json();
  assert.equal(initial.configured, false);

  const invalidResponse = await fetch(`${baseUrl}/api/admin/logo`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      dataUrl: 'data:image/png;base64,bm90LWEtcG5n',
    }),
  });
  const invalid = await invalidResponse.json();
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalid.error.code, 'LOGO_CONTENT_INVALID');

  const pngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  try {
    const uploadResponse = await fetch(`${baseUrl}/api/admin/logo`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ dataUrl: pngDataUrl }),
    });
    const upload = await uploadResponse.json();
    assert.equal(uploadResponse.status, 200);
    assert.equal(upload.configured, true);
    assert.match(upload.url, /^\/api\/site-logo\?v=\d+$/);

    const publicResponse = await fetch(`${baseUrl}/api/site-logo`);
    const bytes = Buffer.from(await publicResponse.arrayBuffer());
    assert.equal(publicResponse.status, 200);
    assert.equal(publicResponse.headers.get('content-type'), 'image/png');
    assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');

    const log = await prisma.adminLog.findFirstOrThrow({
      where: { action: 'UPDATE_LOGO' },
      orderBy: { createdAt: 'desc' },
    });
    assert.deepEqual(log.detail, { operation: 'upload' });
  } finally {
    const deleteResponse = await fetch(`${baseUrl}/api/admin/logo`, {
      method: 'DELETE',
      headers,
    });
    const deleted = await deleteResponse.json();
    assert.equal(deleteResponse.status, 200);
    assert.equal(deleted.configured, false);
  }

  const missingResponse = await fetch(`${baseUrl}/api/site-logo`);
  assert.equal(missingResponse.status, 404);
});

test('管理员可以自定义服规与题库且公开接口不会泄露答案', async () => {
  const headers = {
    Cookie: adminCookie,
    'Content-Type': 'application/json',
  };
  const originalResponse = await fetch(`${baseUrl}/api/admin/content`, {
    headers,
  });
  const originalBody = await originalResponse.json();
  const customContent = {
    agreement: {
      version: 'custom-test-v2',
      title: '自定义测试服规',
      sections: [
        {
          id: 'custom_rule',
          title: '测试规则',
          paragraphs: Array.from(
            { length: 20 },
            (_, index) =>
              `第 ${index + 1} 条：${'请遵守测试服务器规则。'.repeat(80)}`,
          ),
        },
      ],
      signatureStatements: ['我已阅读并同意测试规则。'],
    },
    quiz: {
      passingScore: 50,
      questions: [
        {
          id: 'custom_q1',
          prompt: '第一道自定义题目的正确选项是？',
          options: [
            { id: 'A', text: '选项 A' },
            { id: 'B', text: '选项 B' },
          ],
          correctOptionId: 'B',
        },
        {
          id: 'custom_q2',
          prompt: '第二道自定义题目的正确选项是？',
          options: [
            { id: 'A', text: '选项 A' },
            { id: 'B', text: '选项 B' },
          ],
          correctOptionId: 'A',
        },
      ],
    },
  };
  let customApplicationId: string | undefined;

  try {
    const updateResponse = await fetch(`${baseUrl}/api/admin/content`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(customContent),
    });
    const updateBody = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updateBody.content.agreement.version, 'custom-test-v2');
    assert.equal(updateBody.content.ui.apply.qqLabel, 'QQ 号');
    assert.equal(
      updateBody.content.quiz.questions[0].correctOptionId,
      'B',
    );

    const agreementResponse = await fetch(`${baseUrl}/api/agreement`);
    const agreementBody = await agreementResponse.json();
    assert.equal(agreementBody.agreement.title, '自定义测试服规');
    assert.equal(agreementBody.ui.apply.continueButton, '下一步：阅读服务器规则');

    const quizResponse = await fetch(`${baseUrl}/api/quiz`);
    const quizBody = await quizResponse.json();
    assert.equal(quizBody.questionCount, 2);
    assert.equal(quizBody.passingScore, 50);
    assert.equal(
      'correctOptionId' in quizBody.questions[0],
      false,
    );

    const uiUpdateResponse = await fetch(`${baseUrl}/api/admin/content/ui`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ...updateBody.content.ui,
        apply: {
          ...updateBody.content.ui.apply,
          qqLabel: '联系 QQ',
        },
      }),
    });
    const uiUpdateBody = await uiUpdateResponse.json();
    assert.equal(uiUpdateResponse.status, 200);
    assert.equal(uiUpdateBody.content.ui.apply.qqLabel, '联系 QQ');
    assert.equal(uiUpdateBody.content.agreement.version, 'custom-test-v2');
    assert.equal(uiUpdateBody.content.quiz.questions.length, 2);

    const rulesQuizUpdateResponse = await fetch(
      `${baseUrl}/api/admin/content/rules-quiz`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          agreement: {
            ...customContent.agreement,
            title: '只更新服规题库',
          },
          quiz: customContent.quiz,
        }),
      },
    );
    const rulesQuizUpdateBody = await rulesQuizUpdateResponse.json();
    assert.equal(rulesQuizUpdateResponse.status, 200);
    assert.equal(
      rulesQuizUpdateBody.content.agreement.title,
      '只更新服规题库',
    );
    assert.equal(rulesQuizUpdateBody.content.ui.apply.qqLabel, '联系 QQ');

    const outdatedResponse = await postApplication({
      qqNumber: '323456789',
      minecraftId: 'OutdatedCustomQuiz',
      agreementVersion: originalBody.content.agreement.version,
      agreementAccepted: true,
      answers: {},
    });
    const outdatedBody = await outdatedResponse.json();
    assert.equal(outdatedResponse.status, 409);
    assert.equal(outdatedBody.error.code, 'AGREEMENT_VERSION_OUTDATED');
    assert.equal(
      outdatedBody.error.details.currentVersion,
      'custom-test-v2',
    );

    const applicationResponse = await postApplication({
      qqNumber: '323456789',
      minecraftId: 'CustomQuizPlayer',
      agreementVersion: 'custom-test-v2',
      agreementAccepted: true,
      answers: {
        custom_q1: 'B',
        custom_q2: 'B',
      },
    });
    const applicationBody = await applicationResponse.json();
    customApplicationId = applicationBody.applicationId;

    assert.equal(applicationResponse.status, 201);
    assert.equal(applicationBody.score, 50);
    assert.equal(applicationBody.passed, true);

    const updateLog = await prisma.adminLog.findFirstOrThrow({
      where: { action: 'UPDATE_CONTENT' },
      orderBy: { createdAt: 'desc' },
    });
    assert.equal(
      (
        updateLog.detail as {
          agreementVersion: string;
          questionCount: number;
        }
      ).agreementVersion,
      'custom-test-v2',
    );
  } finally {
    await fetch(`${baseUrl}/api/admin/content`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(originalBody.content),
    });
    if (customApplicationId) {
      await prisma.application.delete({
        where: { id: customApplicationId },
      });
    }
  }
});

test('管理员可以修改并删除申请记录，操作日志保留快照', async () => {
  const createResponse = await postApplication(
    buildValidApplicationPayload('ManageRecord'),
  );
  const created = await createResponse.json();

  const pendingAttempt = await prisma.rconAttempt.create({
    data: {
      applicationId: created.applicationId,
      adminId,
      status: 'PENDING',
    },
  });
  const blockedUpdateResponse = await fetch(
    `${baseUrl}/api/admin/applications/${created.applicationId}`,
    {
      method: 'PATCH',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        qqNumber: '223456789',
        minecraftId: 'BlockedWhileRcon',
      }),
    },
  );
  assert.equal(blockedUpdateResponse.status, 409);
  const blockedDeleteResponse = await fetch(
    `${baseUrl}/api/admin/applications/${created.applicationId}`,
    {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    },
  );
  assert.equal(blockedDeleteResponse.status, 409);
  await prisma.rconAttempt.delete({ where: { id: pendingAttempt.id } });

  const invalidResponse = await fetch(
    `${baseUrl}/api/admin/applications/${created.applicationId}`,
    {
      method: 'PATCH',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        qqNumber: 'invalid',
        minecraftId: 'x',
      }),
    },
  );
  assert.equal(invalidResponse.status, 400);

  const duplicateResponse = await fetch(
    `${baseUrl}/api/admin/applications/${created.applicationId}`,
    {
      method: 'PATCH',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        qqNumber: '223456789',
        minecraftId: 'PendingPlayer',
      }),
    },
  );
  const duplicateBody = await duplicateResponse.json();
  assert.equal(duplicateResponse.status, 409);
  assert.equal(duplicateBody.error.code, 'ACTIVE_APPLICATION_EXISTS');

  const updateResponse = await fetch(
    `${baseUrl}/api/admin/applications/${created.applicationId}`,
    {
      method: 'PATCH',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        qqNumber: '223456789',
        minecraftId: 'ManagedPlayer',
      }),
    },
  );
  const updateBody = await updateResponse.json();

  assert.equal(updateResponse.status, 200);
  assert.equal(updateBody.application.qqNumber, '223456789');
  assert.equal(updateBody.application.minecraftId, 'ManagedPlayer');
  assert.equal(updateBody.application.minecraftIdNormalized, 'managedplayer');

  const updateLog = await prisma.adminLog.findFirstOrThrow({
    where: {
      action: 'UPDATE_APPLICATION',
      targetApplicationId: created.applicationId,
    },
  });
  assert.equal(
    (updateLog.detail as { before: { minecraftId: string } }).before
      .minecraftId,
    'ManageRecord',
  );

  const deleteResponse = await fetch(
    `${baseUrl}/api/admin/applications/${created.applicationId}`,
    {
      method: 'DELETE',
      headers: { Cookie: adminCookie },
    },
  );
  assert.equal(deleteResponse.status, 204);
  assert.equal(
    await prisma.application.findUnique({
      where: { id: created.applicationId },
    }),
    null,
  );

  const deleteLog = await prisma.adminLog.findFirstOrThrow({
    where: { action: 'DELETE_APPLICATION' },
    orderBy: { createdAt: 'desc' },
  });
  const deletedSnapshot = deleteLog.detail as {
    deletedApplication: { minecraftId: string };
  };
  assert.equal(
    deletedSnapshot.deletedApplication.minecraftId,
    'ManagedPlayer',
  );
  assert.equal(deleteLog.targetApplicationId, null);
});

test('RCON 未启用时批准接口不会错误修改申请状态', async () => {
  const response = await fetch(
    `${baseUrl}/api/admin/applications/${pendingApplicationId}/approve`,
    {
      method: 'POST',
      headers: { Cookie: adminCookie },
    },
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, 'RCON_NOT_CONFIGURED');

  const application = await prisma.application.findUniqueOrThrow({
    where: { id: pendingApplicationId },
  });
  assert.equal(application.status, ApplicationStatus.PENDING_REVIEW);
});

test('RCON 未启用时自定义命令接口会拒绝执行', async () => {
  const response = await fetch(`${baseUrl}/api/admin/rcon/command`, {
    method: 'POST',
    headers: {
      Cookie: adminCookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command: 'list' }),
  });
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, 'RCON_COMMAND_FAILED');
});

test('自定义 RCON 命令会被危险命令黑名单拦截', async () => {
  const headers = {
    Cookie: adminCookie,
    'Content-Type': 'application/json',
  };
  const settingsResponse = await fetch(`${baseUrl}/api/admin/settings`, {
    headers,
  });
  const originalSettings = await settingsResponse.json();

  try {
    const updateResponse = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        site: originalSettings.site,
        application: originalSettings.application,
        rcon: {
          enabled: true,
          host: originalSettings.rcon.host,
          port: originalSettings.rcon.port,
          password: 'safe-rcon-password',
          timeoutMs: originalSettings.rcon.timeoutMs,
          whitelistAddCommand: originalSettings.rcon.whitelistAddCommand,
          whitelistReloadCommand:
            originalSettings.rcon.whitelistReloadCommand,
          customCommandsEnabled: true,
          blockedCommands: ['stop', 'op'],
        },
      }),
    });
    assert.equal(updateResponse.status, 200);

    const response = await fetch(`${baseUrl}/api/admin/rcon/command`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ command: '/stop' }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'RCON_COMMAND_FAILED');
    assert.match(body.error.message, /黑名单/);
  } finally {
    await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        site: originalSettings.site,
        application: originalSettings.application,
        rcon: {
          enabled: originalSettings.rcon.enabled,
          host: originalSettings.rcon.host,
          port: originalSettings.rcon.port,
          password: '',
          timeoutMs: originalSettings.rcon.timeoutMs,
          whitelistAddCommand: originalSettings.rcon.whitelistAddCommand,
          whitelistReloadCommand:
            originalSettings.rcon.whitelistReloadCommand,
          customCommandsEnabled:
            originalSettings.rcon.customCommandsEnabled,
          blockedCommands: originalSettings.rcon.blockedCommands,
        },
      }),
    });
  }
});

test('模拟 RCON 成功后申请进入白名单并保存执行记录', async () => {
  const executor: RconExecutor = {
    async addToWhitelist(minecraftId) {
      return {
        command: `whitelist add ${minecraftId}`,
        response: `Added ${minecraftId} to the whitelist`,
      };
    },
  };

  const application = await approveApplication(
    pendingApplicationId,
    adminId,
    {},
    executor,
  );

  assert.equal(application.status, ApplicationStatus.WHITELISTED);

  const attempt = await prisma.rconAttempt.findFirstOrThrow({
    where: { applicationId: pendingApplicationId },
  });
  assert.equal(attempt.status, 'SUCCEEDED');
  assert.match(attempt.response ?? '', /whitelist add PendingPlayer/);
});

test('拒绝接口要求原因并记录审核状态', async () => {
  const createResponse = await postApplication(
    buildValidApplicationPayload('RejectPlayer'),
  );
  const created = await createResponse.json();

  const response = await fetch(
    `${baseUrl}/api/admin/applications/${created.applicationId}/reject`,
    {
      method: 'POST',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: '测试拒绝原因' }),
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'rejected');

  const application = await prisma.application.findUniqueOrThrow({
    where: { id: created.applicationId },
  });
  assert.equal(application.rejectReason, '测试拒绝原因');
  assert.equal(application.reviewerId, adminId);
});

test('RCON 失败会保留失败状态，重试成功后进入白名单', async () => {
  const createResponse = await postApplication(
    buildValidApplicationPayload('RetryPlayer'),
  );
  const created = await createResponse.json();
  const failingExecutor: RconExecutor = {
    async addToWhitelist() {
      throw new Error('connect ECONNREFUSED');
    },
  };

  await assert.rejects(
    approveApplication(
      created.applicationId,
      adminId,
      {},
      failingExecutor,
    ),
    (error: unknown) =>
      error instanceof ReviewOperationError &&
      error.code === 'RCON_EXECUTION_FAILED',
  );

  const failedApplication = await prisma.application.findUniqueOrThrow({
    where: { id: created.applicationId },
  });
  assert.equal(failedApplication.status, ApplicationStatus.RCON_FAILED);

  const successExecutor: RconExecutor = {
    async addToWhitelist(minecraftId) {
      return {
        command: `whitelist add ${minecraftId}`,
        response: 'success',
      };
    },
  };
  const retriedApplication = await retryApplicationRcon(
    created.applicationId,
    adminId,
    {},
    successExecutor,
  );

  assert.equal(retriedApplication.status, ApplicationStatus.WHITELISTED);
  assert.equal(
    await prisma.rconAttempt.count({
      where: { applicationId: created.applicationId },
    }),
    2,
  );
});

test('统计接口返回概览、状态分布和最近 14 天趋势', async () => {
  const response = await fetch(`${baseUrl}/api/admin/statistics`, {
    headers: { Cookie: adminCookie },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.overview.totalApplications, 4);
  assert.equal(body.overview.recent7Days, 4);
  assert.equal(body.overview.quizPassRate, 75);
  assert.equal(body.overview.reviewApprovalRate, 66.7);
  assert.equal(body.overview.rconSuccessRate, 66.7);
  assert.equal(body.statusDistribution.whitelisted, 2);
  assert.equal(body.statusDistribution.rejected, 1);
  assert.equal(body.statusDistribution.quizFailed, 1);
  assert.equal(body.rconAttempts.succeeded, 2);
  assert.equal(body.rconAttempts.failed, 1);
  assert.equal(body.dailyTrend.length, 14);
  assert.equal(
    body.dailyTrend.reduce(
      (total: number, day: { submitted: number }) =>
        total + day.submitted,
      0,
    ),
    4,
  );
});

test('退出后管理员会话立即失效', async () => {
  const headers = {
    Cookie: adminCookie,
  };
  const logoutResponse = await fetch(`${baseUrl}/api/admin/logout`, {
    method: 'POST',
    headers,
  });

  assert.equal(logoutResponse.status, 204);

  const sessionResponse = await fetch(`${baseUrl}/api/admin/session`, {
    headers,
  });
  const body = await sessionResponse.json();

  assert.equal(sessionResponse.status, 401);
  assert.equal(body.error.code, 'ADMIN_SESSION_INVALID');
});

test('管理员可以恢复出厂设置并重新进入部署流程', async () => {
  const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'test_admin',
      password: 'admin123',
    }),
  });
  const resetCookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.equal(loginResponse.status, 200);
  assert.ok(resetCookie);

  const invalidResponse = await fetch(
    `${baseUrl}/api/admin/system/factory-reset`,
    {
      method: 'POST',
      headers: {
        Cookie: resetCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmation: 'WRONG' }),
    },
  );
  assert.equal(invalidResponse.status, 400);

  const response = await fetch(`${baseUrl}/api/admin/system/factory-reset`, {
    method: 'POST',
    headers: {
      Cookie: resetCookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirmation: 'RESET' }),
  });
  const body = await response.json();
  const clearedCookie = response.headers.get('set-cookie') ?? '';

  assert.equal(response.status, 200);
  assert.equal(body.setupRequired, true);
  assert.match(body.setupToken, /^[A-Za-z0-9_-]{16,}$/);
  assert.match(clearedCookie, /craft_pass_admin_session=;/);
  assert.equal(await prisma.admin.count(), 0);
  assert.equal(await prisma.application.count(), 0);

  const setupStatusResponse = await fetch(`${baseUrl}/api/setup/status`);
  const setupStatus = await setupStatusResponse.json();
  assert.equal(setupStatus.setupRequired, true);

  const completeResponse = await fetch(`${baseUrl}/api/setup/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      setupToken: body.setupToken,
      siteName: 'Craft Pass Reset',
      siteSubtitle: '重新部署测试',
      admin: {
        username: 'reset_admin',
        password: 'admin123',
      },
      rcon: {
        enabled: false,
        host: '127.0.0.1',
        port: 25575,
        password: '',
        timeoutMs: 5000,
        whitelistAddCommand: 'whitelist add {minecraftId}',
        whitelistReloadCommand: '',
      },
    }),
  });
  const completeBody = await completeResponse.json();

  assert.equal(completeResponse.status, 201);
  assert.equal(completeBody.admin.username, 'reset_admin');
});

function buildValidApplicationPayload(minecraftId: string) {
  return {
    qqNumber: '123456789',
    minecraftId,
    agreementVersion: agreement.version,
    agreementAccepted: true,
    answers: buildAnswers(quizQuestions.length),
  };
}

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

function postApplication(payload: unknown) {
  return fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
