import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

export interface FFmpegOptions {
  input: string;
  output: string;
  videoCodec?: string;
  audioCodec?: string;
  format?: string;
  quality?: string;
}

function findFFmpeg(): string | null {
  const candidates = [
    'ffmpeg',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  ];

  for (const p of candidates) {
    if (p === 'ffmpeg') {
      try {
        require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
        return 'ffmpeg';
      } catch {
        continue;
      }
    }
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function mergeVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<string> {
  const ffmpegPath = findFFmpeg();
  if (!ffmpegPath) {
    throw new Error('FFmpeg not found. Please install FFmpeg or ensure it is in your PATH.');
  }

  const args = [
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-strict', 'experimental',
    '-y',
    outputPath,
  ];

  await execFileAsync(ffmpegPath, args);
  return outputPath;
}

export async function convertFormat(
  inputPath: string,
  outputPath: string,
  format: string = 'mp4'
): Promise<string> {
  const ffmpegPath = findFFmpeg();
  if (!ffmpegPath) {
    throw new Error('FFmpeg not found.');
  }

  const args = [
    '-i', inputPath,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-f', format,
    '-y',
    outputPath,
  ];

  await execFileAsync(ffmpegPath, args);
  return outputPath;
}

export async function extractAudio(
  inputPath: string,
  outputPath: string,
  audioFormat: string = 'mp3',
  audioQuality: string = '192k'
): Promise<string> {
  const ffmpegPath = findFFmpeg();
  if (!ffmpegPath) {
    throw new Error('FFmpeg not found.');
  }

  const args = [
    '-i', inputPath,
    '-vn',
    '-ab', audioQuality,
    '-f', audioFormat,
    '-y',
    outputPath,
  ];

  await execFileAsync(ffmpegPath, args);
  return outputPath;
}

export async function getVideoDuration(inputPath: string): Promise<number> {
  const ffmpegPath = findFFmpeg();
  if (!ffmpegPath) {
    throw new Error('FFmpeg not found.');
  }

  try {
    const { stderr } = await execFileAsync(ffmpegPath, ['-i', inputPath]);
    const match = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }
  } catch {
    // ffprobe might be better for this, but fallback to 0
  }
  return 0;
}

export async function generateThumbnail(
  inputPath: string,
  outputPath: string,
  timestamp: string = '00:00:01'
): Promise<string> {
  const ffmpegPath = findFFmpeg();
  if (!ffmpegPath) {
    throw new Error('FFmpeg not found.');
  }

  const args = [
    '-i', inputPath,
    '-ss', timestamp,
    '-vframes', '1',
    '-y',
    outputPath,
  ];

  await execFileAsync(ffmpegPath, args);
  return outputPath;
}

export function isFFmpegAvailable(): boolean {
  return findFFmpeg() !== null;
}
