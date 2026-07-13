import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const sourceRoots = ['frontend/src', 'backend/src', 'backend/scripts', 'backend/tests', 'scripts'];
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);
const resolutionExtensions = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css'];
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'generated']);
const errors = [];

async function walk(relativeDirectory) {
  const absoluteDirectory = path.join(projectDirectory, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await walk(relativePath)));
      }
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

async function hasExactCase(absolutePath) {
  const relativePath = path.relative(projectDirectory, absolutePath);
  let currentDirectory = projectDirectory;

  for (const segment of relativePath.split(path.sep)) {
    const entries = await readdir(currentDirectory);
    if (!entries.includes(segment)) {
      return false;
    }
    currentDirectory = path.join(currentDirectory, segment);
  }

  return true;
}

async function existsIgnoringCase(absolutePath) {
  const relativePath = path.relative(projectDirectory, absolutePath);
  let currentDirectory = projectDirectory;

  for (const segment of relativePath.split(path.sep)) {
    const entries = await readdir(currentDirectory);
    const match = entries.find(
      (entry) => entry.toLowerCase() === segment.toLowerCase(),
    );
    if (!match) {
      return false;
    }
    currentDirectory = path.join(currentDirectory, match);
  }

  return true;
}

async function getResolutionStatus(importer, specifier) {
  const requestedPath = path.resolve(path.dirname(importer), specifier);
  const candidates = [];

  for (const extension of resolutionExtensions) {
    candidates.push(`${requestedPath}${extension}`);
  }
  for (const extension of resolutionExtensions.slice(1)) {
    candidates.push(path.join(requestedPath, `index${extension}`));
  }

  if (specifier.endsWith('.js')) {
    const withoutExtension = requestedPath.slice(0, -3);
    candidates.unshift(`${withoutExtension}.ts`, `${withoutExtension}.tsx`, `${withoutExtension}.mts`);
  }

  for (const candidate of candidates) {
    try {
      if (await hasExactCase(candidate)) {
        return 'exact';
      }
    } catch {
      // The candidate does not exist or one of its parent paths is not a directory.
    }
  }

  for (const candidate of candidates) {
    try {
      if (await existsIgnoringCase(candidate)) {
        return 'case-mismatch';
      }
    } catch {
      // The candidate does not exist. TypeScript or the build will report it.
    }
  }

  return 'missing';
}

for (const root of sourceRoots) {
  for (const relativeFile of await walk(root)) {
    if (!sourceExtensions.has(path.extname(relativeFile))) {
      continue;
    }

    const absoluteFile = path.join(projectDirectory, relativeFile);
    const source = await readFile(absoluteFile, 'utf8');
    const importPattern = /(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g;

    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (
        specifier?.startsWith('.') &&
        (await getResolutionStatus(absoluteFile, specifier)) === 'case-mismatch'
      ) {
        errors.push(`${relativeFile}: relative import has incorrect filename casing: ${specifier}`);
      }
    }
  }
}

for (const relativeFile of await walk('.')) {
  if (path.extname(relativeFile) === '.sh') {
    const contents = await readFile(path.join(projectDirectory, relativeFile));
    if (contents.includes(Buffer.from('\r\n'))) {
      errors.push(`${relativeFile}: shell scripts must use LF line endings`);
    }
  }
}

for (const packageFile of ['package.json', 'frontend/package.json', 'backend/package.json']) {
  const packageJson = JSON.parse(await readFile(path.join(projectDirectory, packageFile), 'utf8'));
  for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    if (/^(?:copy|xcopy|del|rmdir\s+\/s|set\s+\w+=)/i.test(command.trim())) {
      errors.push(`${packageFile} script ${name} uses a Windows-only command: ${command}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Platform compatibility check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log('Platform compatibility check passed.');
