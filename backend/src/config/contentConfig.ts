import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agreement } from './agreement.js';
import { env } from './env.js';
import { passingScore, quizQuestions } from './quiz.js';
import {
  contentConfigSchema,
  defaultUiContent,
  type ContentConfig,
} from '../schemas/content.js';

const defaultDataDirectory = fileURLToPath(
  new URL('../../data/', import.meta.url),
);
const dataDirectory = env.runtimeDataDir
  ? resolve(env.runtimeDataDir)
  : defaultDataDirectory;
const contentConfigPath = resolve(dataDirectory, 'content-config.json');

const defaultContent: ContentConfig = contentConfigSchema.parse({
  ui: defaultUiContent,
  agreement,
  quiz: {
    passingScore,
    questions: quizQuestions,
  },
});

export function getContentConfig(): ContentConfig {
  if (!existsSync(contentConfigPath)) {
    return structuredClone(defaultContent);
  }

  return contentConfigSchema.parse(
    JSON.parse(readFileSync(contentConfigPath, 'utf8')),
  );
}

export function saveContentConfig(content: ContentConfig) {
  const validated = contentConfigSchema.parse(content);
  const temporaryPath = `${contentConfigPath}.tmp`;

  mkdirSync(dataDirectory, { recursive: true });
  writeFileSync(temporaryPath, JSON.stringify(validated, null, 2), 'utf8');
  renameSync(temporaryPath, contentConfigPath);

  return getContentConfig();
}

export function resetContentConfig() {
  rmSync(contentConfigPath, { force: true });
}
