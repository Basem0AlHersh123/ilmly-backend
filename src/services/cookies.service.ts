import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COOKIES_DIR = path.join(process.cwd(), 'cookies');

if (!fs.existsSync(COOKIES_DIR)) {
  fs.mkdirSync(COOKIES_DIR, { recursive: true });
}

function getCookiesFilePath(): string {
  return path.join(COOKIES_DIR, 'cookies.txt');
}

export async function isCookieSupportEnabled(): Promise<boolean> {
  const settings = await prisma.settings.findFirst();
  return settings?.cookieSupport || false;
}

export async function saveCookiesFile(fileBuffer: Buffer, fileName: string): Promise<{ success: boolean; message: string }> {
  try {
    const filePath = getCookiesFilePath();
    fs.writeFileSync(filePath, fileBuffer);

    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: { cookieSupport: true, cookieMethod: 'manual' },
      });
    } else {
      await prisma.settings.update({
        where: { id: settings.id },
        data: { cookieSupport: true, cookieMethod: 'manual' },
      });
    }

    return { success: true, message: 'Cookies file saved successfully' };
  } catch (error) {
    return { success: false, message: `Failed to save cookies: ${error}` };
  }
}

export async function syncCookiesFromExtension(cookiesJson: any[]): Promise<{ success: boolean; message: string }> {
  try {
    const netscapeCookies = convertToNetscapeFormat(cookiesJson);
    const filePath = getCookiesFilePath();
    fs.writeFileSync(filePath, netscapeCookies);

    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: { cookieSupport: true, cookieMethod: 'extension' },
      });
    } else {
      await prisma.settings.update({
        where: { id: settings.id },
        data: { cookieSupport: true, cookieMethod: 'extension' },
      });
    }

    return { success: true, message: 'Cookies synced from browser extension' };
  } catch (error) {
    return { success: false, message: `Failed to sync cookies: ${error}` };
  }
}

export function convertToNetscapeFormat(cookies: any[]): string {
  let output = '# Netscape HTTP Cookie File\n';
  output += '# This is a generated file. Do not edit.\n\n';

  for (const cookie of cookies) {
    const domain = cookie.domain || '';
    const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const path = cookie.path || '/';
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expiration = cookie.expirationDate ? Math.floor(cookie.expirationDate) : 0;
    const name = cookie.name || '';
    const value = cookie.value || '';

    output += `${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`;
  }

  return output;
}

export async function getCookiesStatus(): Promise<{
  enabled: boolean;
  method: string;
  exists: boolean;
  lastModified: string | null;
  ageDays: number | null;
}> {
  const settings = await prisma.settings.findFirst();
  const filePath = getCookiesFilePath();
  const exists = fs.existsSync(filePath);

  let lastModified: string | null = null;
  let ageDays: number | null = null;

  if (exists) {
    const stats = fs.statSync(filePath);
    lastModified = stats.mtime.toISOString();
    const now = new Date();
    const diffMs = now.getTime() - stats.mtime.getTime();
    ageDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  return {
    enabled: settings?.cookieSupport || false,
    method: settings?.cookieMethod || 'manual',
    exists,
    lastModified,
    ageDays,
  };
}

export async function clearCookies(): Promise<{ success: boolean; message: string }> {
  try {
    const filePath = getCookiesFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const settings = await prisma.settings.findFirst();
    if (settings) {
      await prisma.settings.update({
        where: { id: settings.id },
        data: { cookieSupport: false },
      });
    }

    return { success: true, message: 'Cookies cleared successfully' };
  } catch (error) {
    return { success: false, message: `Failed to clear cookies: ${error}` };
  }
}

export function getCookiesFilePathForYtDlp(): string | null {
  const filePath = getCookiesFilePath();
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}
