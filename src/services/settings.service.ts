import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getSettings() {
  let settings = await prisma.settings.findFirst();

  if (!settings) {
    settings = await prisma.settings.create({
      data: {},
    });
  }

  return {
    youtubeApiKey: settings.youtubeApiKey,
    quotaUsed: settings.quotaUsed,
    quotaResetDate: settings.quotaResetDate,
    maxConcurrentDownloads: settings.maxConcurrentDownloads,
    wifiOnlyDownloads: settings.wifiOnlyDownloads,
    nightDownloadMode: settings.nightDownloadMode,
    downloadLocation: settings.downloadLocation,
    defaultQuality: settings.defaultQuality,
    pauseOnLowBattery: settings.pauseOnLowBattery,
    batteryThreshold: settings.batteryThreshold,
    cookieSupport: settings.cookieSupport,
    cookieMethod: settings.cookieMethod,
    onboardingComplete: settings.onboardingComplete,
    theme: settings.theme,
    defaultPlaybackSpeed: settings.defaultPlaybackSpeed,
    autoPlayNext: settings.autoPlayNext,
    resumeFromLastPosition: settings.resumeFromLastPosition,
  };
}

export async function updateSettings(updates: Record<string, any>) {
  let settings = await prisma.settings.findFirst();

  if (!settings) {
    settings = await prisma.settings.create({ data: updates });
  } else {
    settings = await prisma.settings.update({
      where: { id: settings.id },
      data: updates,
    });
  }

  return getSettings();
}

export function isNightTime(settings: { nightDownloadMode: boolean; nightStartHour?: number; nightEndHour?: number }): boolean {
  if (!settings.nightDownloadMode) return false;

  const hour = new Date().getHours();
  const nightStartHour = settings.nightStartHour ?? 23;
  const nightEndHour = settings.nightEndHour ?? 6;

  if (nightStartHour > nightEndHour) {
    return hour >= nightStartHour || hour < nightEndHour;
  }
  return hour >= nightStartHour && hour < nightEndHour;
}

export async function canDownloadNow(): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getSettings();

  if (settings.nightDownloadMode && !isNightTime(settings)) {
    return {
      allowed: false,
      reason: 'Night download mode is on. Downloads will start after 11pm.',
    };
  }

  return { allowed: true };
}
