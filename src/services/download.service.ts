import { execFile, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { sanitizeYouTubeUrl } from '../utils/sanitize';
import { getNodePath } from './ytdlp.service';
import { getCookiesFilePathForYtDlp } from './cookies.service';
import { getSettings } from './settings.service';

const prisma = new PrismaClient();

const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

const activeProcesses = new Map<string, ChildProcess>();

const MAX_RETRIES = 3;

function getYtDlpDownloadArgs(url: string, quality: string): string[] {
  const cleanUrl = sanitizeYouTubeUrl(url);
  const outputTemplate = path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s');

  const args: string[] = [
    '--no-playlist',
    '--output', outputTemplate,
    '--newline',
    '--progress',
    '--continue',
  ];

  const nodePath = getNodePath();
  if (nodePath) {
    args.push('--js-runtimes', `node:${nodePath}`);
  } else {
    args.push('--js-runtimes', 'node');
  }

  const cookiesPath = getCookiesFilePathForYtDlp();
  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }

  if (quality === 'audio') {
    args.push(
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0'
    );
  } else {
    const height = quality.replace('p', '');
    args.push(
      '-f', `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`,
      '--merge-output-format', 'mp4'
    );
  }

  args.push(url);
  return args;
}

async function getActiveDownloadCount(): Promise<number> {
  const active = await prisma.download.count({
    where: { status: 'downloading' },
  });
  return active;
}

async function getMaxConcurrentDownloads(): Promise<number> {
  const settings = await getSettings();
  return settings.maxConcurrentDownloads || 2;
}

export async function startDownload(url: string, quality: string, downloadId: string) {
  const maxConcurrent = await getMaxConcurrentDownloads();
  const activeCount = await getActiveDownloadCount();

  if (activeCount >= maxConcurrent) {
    await prisma.download.update({
      where: { id: downloadId },
      data: { status: 'queued' },
    });
    return { status: 'queued', message: 'Download queued, will start when slot is available' };
  }

  const args = getYtDlpDownloadArgs(url, quality);

  await prisma.download.update({
    where: { id: downloadId },
    data: { status: 'downloading' },
  });

  return new Promise<string>((resolve, reject) => {
    const child = execFile('yt-dlp', args);
    activeProcesses.set(downloadId, child);

    let outputPath = '';
    let lastProgress = 0;

    child.stdout?.on('data', async (data: Buffer) => {
      const line = data.toString().trim();
      parseYtDlpOutput(line);
    });

    child.stderr?.on('data', async (data: Buffer) => {
      const line = data.toString().trim();
      parseYtDlpOutput(line);
    });

    async function parseYtDlpOutput(line: string) {
      const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (progressMatch) {
        const progress = Math.floor(parseFloat(progressMatch[1]));

        if (progress > lastProgress) {
          lastProgress = progress;
          await prisma.download.update({
            where: { id: downloadId },
            data: { progress }
          }).catch(console.error);
        }
      }

      if (line.includes('[Merger]') && line.includes('Merging formats into')) {
        const match = line.match(/"(.+?)"/);
        if (match) outputPath = match[1];
      }

      if (line.includes('[download] Destination:')) {
        outputPath = line.split('Destination:')[1]?.trim() || '';
      }

      if (line.includes('[ExtractAudio] Destination:')) {
        outputPath = line.split('Destination:')[1]?.trim() || '';
      }

      if (line.includes('[ffmpeg] Destination:')) {
        outputPath = line.split('Destination:')[1]?.trim() || '';
      }

      if (line.includes('[download] has already been downloaded')) {
        const match = line.match(/"(.+?)"/);
        if (match) outputPath = match[1];
      }
    }

    child.on('close', async (code) => {
      activeProcesses.delete(downloadId);

      if (code === 0) {
        let fileSize = 0;

        if (!outputPath || !fs.existsSync(outputPath)) {
          const download = await prisma.download.findUnique({ where: { id: downloadId } });
          if (download) {
            const files = fs.readdirSync(DOWNLOAD_DIR);
            // Try matching by youtubeId first (legacy), then by title
            const matchingFile = files.find(f =>
              f.startsWith(download.youtubeId) ||
              f.toLowerCase().includes(download.title.toLowerCase().slice(0, 30))
            );
            if (matchingFile) {
              outputPath = path.join(DOWNLOAD_DIR, matchingFile);
            } else if (files.length > 0) {
              // Fallback: use the newest file in the download dir
              const newest = files
                .map(f => ({ name: f, time: fs.statSync(path.join(DOWNLOAD_DIR, f)).mtimeMs }))
                .sort((a, b) => b.time - a.time)[0];
              if (newest) {
                outputPath = path.join(DOWNLOAD_DIR, newest.name);
              }
            }
          }
        }

        if (outputPath && fs.existsSync(outputPath)) {
          fileSize = fs.statSync(outputPath).size;
        }

        const download = await prisma.download.findUnique({
          where: { id: downloadId }
        });

        if (download) {
          const existingVideo = await prisma.video.findFirst({
            where: {
              youtubeId: download.youtubeId,
              quality: download.quality,
            }
          });

          if (!existingVideo) {
            await prisma.video.create({
              data: {
                youtubeId: download.youtubeId,
                title: download.title,
                channelName: 'Unknown',
                duration: 0,
                fileSize,
                filePath: outputPath,
                thumbnailUrl: '',
                quality: download.quality,
                hasSubtitles: false,
              }
            });
          } else {
            await prisma.video.update({
              where: { id: existingVideo.id },
              data: { filePath: outputPath, fileSize },
            });
          }
        }

        await prisma.download.update({
          where: { id: downloadId },
          data: { status: 'completed', progress: 100, finishedAt: new Date() },
        });

        processQueue();
        resolve(outputPath);
      } else {
        const download = await prisma.download.findUnique({ where: { id: downloadId } });
        const retries = download?.retries || 0;

        if (retries < MAX_RETRIES) {
          await prisma.download.update({
            where: { id: downloadId },
            data: { status: 'queued', retries: retries + 1 },
          });

          setTimeout(() => {
            processQueue();
          }, 5000 * (retries + 1));
        } else {
          await prisma.download.update({
            where: { id: downloadId },
            data: { status: 'failed', error: `Failed after ${MAX_RETRIES} retries` },
          });
          processQueue();
        }

        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    child.on('error', async (err) => {
      activeProcesses.delete(downloadId);

      await prisma.download.update({
        where: { id: downloadId },
        data: { status: 'failed', error: err.message },
      });

      processQueue();
      reject(err);
    });
  });
}

export async function cancelDownload(downloadId: string): Promise<void> {
  const child = activeProcesses.get(downloadId);
  if (child) {
    child.kill('SIGTERM');
    activeProcesses.delete(downloadId);
  }

  await prisma.download.update({
    where: { id: downloadId },
    data: { status: 'cancelled' },
  });

  processQueue();
}

export async function pauseDownload(downloadId: string): Promise<void> {
  const child = activeProcesses.get(downloadId);
  if (child) {
    child.kill('SIGTERM');
    activeProcesses.delete(downloadId);
  }

  await prisma.download.update({
    where: { id: downloadId },
    data: { status: 'paused' },
  });

  processQueue();
}

export async function resumeDownload(downloadId: string): Promise<void> {
  const download = await prisma.download.findUnique({
    where: { id: downloadId }
  });

  if (!download || (download.status !== 'paused' && download.status !== 'failed')) {
    throw new Error('Download cannot be resumed');
  }

  await prisma.download.update({
    where: { id: downloadId },
    data: { status: 'queued', retries: 0, error: '' },
  });

  processQueue();
}

export async function processQueue(): Promise<void> {
  const maxConcurrent = await getMaxConcurrentDownloads();
  const activeCount = await getActiveDownloadCount();

  if (activeCount >= maxConcurrent) return;

  const queuedDownloads = await prisma.download.findMany({
    where: { status: 'queued' },
    orderBy: { startedAt: 'asc' },
    take: maxConcurrent - activeCount,
  });

  for (const download of queuedDownloads) {
    startDownload(download.url, download.quality, download.id).catch(console.error);
  }
}

export async function getAllDownloads() {
  return prisma.download.findMany({
    orderBy: { startedAt: 'desc' }
  });
}

export function isProcessActive(downloadId: string): boolean {
  return activeProcesses.has(downloadId);
}
