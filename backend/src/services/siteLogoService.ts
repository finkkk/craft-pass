import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const maxLogoBytes = 400 * 1024;
const allowedMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const defaultDataDirectory = fileURLToPath(
  new URL('../../data/', import.meta.url),
);
const dataDirectory = env.runtimeDataDir
  ? resolve(env.runtimeDataDir)
  : defaultDataDirectory;
const logoFilePath = resolve(dataDirectory, 'site-logo.bin');
const logoMetadataPath = resolve(dataDirectory, 'site-logo.json');

interface LogoMetadata {
  mimeType: string;
}

export function getSiteLogoStatus() {
  if (!existsSync(logoFilePath) || !existsSync(logoMetadataPath)) {
    return {
      configured: false,
      url: null,
    };
  }

  return {
    configured: true,
    url: `/api/site-logo?v=${Math.floor(statSync(logoFilePath).mtimeMs)}`,
  };
}

export function getSiteLogo() {
  if (!existsSync(logoFilePath) || !existsSync(logoMetadataPath)) {
    return null;
  }

  const metadata = JSON.parse(
    readFileSync(logoMetadataPath, 'utf8'),
  ) as LogoMetadata;

  if (!allowedMimeTypes.has(metadata.mimeType)) {
    throw new SiteLogoError('LOGO_METADATA_INVALID', 'Logo 元数据无效');
  }

  return {
    bytes: readFileSync(logoFilePath),
    mimeType: metadata.mimeType,
  };
}

export function saveSiteLogo(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl,
  );

  if (!match?.[1] || !match[2] || !allowedMimeTypes.has(match[1])) {
    throw new SiteLogoError(
      'LOGO_FORMAT_INVALID',
      'Logo 只支持 PNG、JPEG 或 WebP 图片',
    );
  }

  const bytes = Buffer.from(match[2], 'base64');

  if (bytes.length === 0 || bytes.length > maxLogoBytes) {
    throw new SiteLogoError(
      'LOGO_SIZE_INVALID',
      'Logo 文件大小必须在 400KB 以内',
    );
  }

  if (!matchesImageSignature(bytes, match[1])) {
    throw new SiteLogoError(
      'LOGO_CONTENT_INVALID',
      'Logo 文件内容与图片格式不匹配',
    );
  }

  mkdirSync(dataDirectory, { recursive: true });
  const temporaryLogoPath = `${logoFilePath}.tmp`;
  const temporaryMetadataPath = `${logoMetadataPath}.tmp`;

  writeFileSync(temporaryLogoPath, bytes);
  writeFileSync(
    temporaryMetadataPath,
    JSON.stringify({ mimeType: match[1] }, null, 2),
    'utf8',
  );
  renameSync(temporaryLogoPath, logoFilePath);
  renameSync(temporaryMetadataPath, logoMetadataPath);

  return getSiteLogoStatus();
}

export function deleteSiteLogo() {
  rmSync(logoFilePath, { force: true });
  rmSync(logoMetadataPath, { force: true });

  return getSiteLogoStatus();
}

function matchesImageSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === 'image/png') {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }

  if (mimeType === 'image/jpeg') {
    return (
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  return (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

export class SiteLogoError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'SiteLogoError';
  }
}
