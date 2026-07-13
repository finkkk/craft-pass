import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
) as { version: string };

export const currentVersion = packageJson.version;

const repository = 'finkkk/craft-pass';
const releasesApiUrl = `https://api.github.com/repos/${repository}/releases/latest`;
const repositoryUrl = `https://github.com/${repository}`;
const cacheLifetimeMs = 6 * 60 * 60 * 1_000;

export interface VersionStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseName: string | null;
  releaseUrl: string;
  publishedAt: string | null;
  checkedAt: string;
  errorMessage: string | null;
}

let cachedStatus: VersionStatus | null = null;
let inFlight: Promise<VersionStatus> | null = null;

export function getVersionStatus() {
  if (
    cachedStatus &&
    Date.now() - new Date(cachedStatus.checkedAt).getTime() < cacheLifetimeMs
  ) {
    return Promise.resolve(cachedStatus);
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = checkLatestRelease().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function checkLatestRelease(): Promise<VersionStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(releasesApiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `craft-pass/${currentVersion}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new Error(`GitHub API 返回 HTTP ${response.status}`);
    }

    const release = (await response.json()) as {
      tag_name?: string;
      name?: string | null;
      html_url?: string;
      published_at?: string | null;
    };
    if (!release.tag_name) {
      throw new Error('GitHub Release 缺少版本标签');
    }

    cachedStatus = {
      currentVersion,
      latestVersion: release.tag_name,
      updateAvailable: isVersionNewer(release.tag_name, currentVersion),
      releaseName: release.name ?? null,
      releaseUrl: release.html_url ?? `${repositoryUrl}/releases`,
      publishedAt: release.published_at ?? null,
      checkedAt,
      errorMessage: null,
    };
  } catch (error) {
    cachedStatus = {
      currentVersion,
      latestVersion: cachedStatus?.latestVersion ?? null,
      updateAvailable: cachedStatus?.updateAvailable ?? false,
      releaseName: cachedStatus?.releaseName ?? null,
      releaseUrl: cachedStatus?.releaseUrl ?? `${repositoryUrl}/releases`,
      publishedAt: cachedStatus?.publishedAt ?? null,
      checkedAt,
      errorMessage: error instanceof Error ? error.message : '无法检查新版本',
    };
  }

  return cachedStatus;
}

export function isVersionNewer(candidate: string, current: string) {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  if (!candidateParts || !currentParts) return false;

  for (let index = 0; index < 3; index += 1) {
    const difference = candidateParts[index]! - currentParts[index]!;
    if (difference !== 0) return difference > 0;
  }
  return false;
}

function parseVersion(value: string) {
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function startVersionCheckScheduler() {
  void getVersionStatus();
  const timer = setInterval(() => void getVersionStatus(), cacheLifetimeMs);
  timer.unref();
  return timer;
}
