import { PrismaClient } from '@prisma/client';
import { processQueue } from './download.service';

const prisma = new PrismaClient();

export async function getQueueStatus() {
  const all = await prisma.download.findMany({
    where: { status: { in: ['queued', 'downloading'] } },
    orderBy: { startedAt: 'asc' }
  });
  return all;
}

export async function addToQueue(
  url: string,
  youtubeId: string,
  title: string,
  channelName: string,
  duration: number,
  thumbnail: string,
  quality: string
): Promise<string> {
  const existing = await prisma.download.findFirst({
    where: {
      youtubeId,
      quality,
      status: { in: ['queued', 'downloading'] }
    }
  });

  if (existing) {
    throw new Error('This video is already in your download queue');
  }

  const alreadyDownloaded = await prisma.video.findFirst({
    where: { youtubeId, quality, filePath: { not: '' } }
  });

  if (alreadyDownloaded) {
    throw new Error('You already have this video in your library');
  }

  const download = await prisma.download.create({
    data: {
      youtubeId,
      title,
      url,
      quality,
      status: 'queued',
      progress: 0,
    }
  });

  await prisma.video.upsert({
    where: {
      youtubeId: youtubeId,
    },
    update: {},
    create: {
      youtubeId,
      title,
      channelName,
      duration,
      fileSize: 0,
      filePath: '',
      thumbnailUrl: thumbnail,
      quality,
      hasSubtitles: false,
    }
  });

  processQueue();
  return download.id;
}
