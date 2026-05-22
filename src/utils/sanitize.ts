import { URL } from 'url';

const DANGEROUS_PATTERNS = [
  /[;&|`$<>]/,
  /\.\./,
  /\/etc\//,
  /javascript:/i,
  /data:/i,
];

export function sanitizeYouTubeUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only HTTP/HTTPS URLs are allowed');
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(rawUrl)) {
      throw new Error('URL contains invalid characters');
    }
  }

  const cleanUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}${parsed.search}`;
  return cleanUrl;
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_.() ]/g, '_') // only safe characters
    .replace(/\s+/g, '_')
    .substring(0, 200); // max length
}