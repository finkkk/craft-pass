import assert from 'node:assert/strict';
import test from 'node:test';
import { completeSetupSchema } from '../src/schemas/setup.js';
import { updateSettingsSchema } from '../src/schemas/settings.js';

const setupInput = {
  setupToken: '1234567890abcdef',
  siteName: 'Craft Pass',
  siteSubtitle: '服务器入服审核',
  admin: {
    username: 'admin',
    password: 'admin123',
  },
  rcon: {
    enabled: true,
    host: '127.0.0.1',
    port: 25_575,
    password: 'abc',
    timeoutMs: 5_000,
    whitelistAddCommand: 'whitelist add {minecraftId}',
    whitelistReloadCommand: '',
  },
};

const settingsInput = {
  site: {
    name: 'Craft Pass',
    subtitle: '服务器入服审核',
  },
  application: {
    submissionsEnabled: true,
    quizFailCooldownMinutes: 0,
    rateLimitWindowMinutes: 15,
    maxSubmissionsPerIp: 50,
    maxSubmissionsPerQq: 20,
    maxSubmissionsPerMinecraftId: 5,
  },
  rcon: {
    enabled: true,
    host: '127.0.0.1',
    port: 25_575,
    password: 'abc',
    timeoutMs: 5_000,
    whitelistAddCommand: 'whitelist add {minecraftId}',
    whitelistReloadCommand: '',
    customCommandsEnabled: true,
    blockedCommands: [],
  },
};

test('RCON 密码最少允许 3 位，并拒绝不足 3 位的密码', () => {
  assert.equal(completeSetupSchema.safeParse(setupInput).success, true);
  assert.equal(updateSettingsSchema.safeParse(settingsInput).success, true);

  assert.equal(
    completeSetupSchema.safeParse({
      ...setupInput,
      rcon: { ...setupInput.rcon, password: 'ab' },
    }).success,
    false,
  );
  assert.equal(
    updateSettingsSchema.safeParse({
      ...settingsInput,
      rcon: { ...settingsInput.rcon, password: 'ab' },
    }).success,
    false,
  );
});
