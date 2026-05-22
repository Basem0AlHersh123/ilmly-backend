import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();
// Where videos will be saved on the machine
const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

// Create downloads folder if it doesn't exist
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

export async function startDownload(
  url: string,
  quality: string,
  downloadId: string
) {
  const outputTemplate = path.join(DOWNLOAD_DIR, '%(id)s.%(ext)s');

  // Build argument array — NEVER concatenate into a shell string
  const args = [
    '--no-playlist',
    '--output', outputTemplate,
    '--newline', // print progress on new lines so we can parse it
  ];

  if (quality === 'audio') {
    args.push('--extract-audio', '--audio-format', 'mp3');
  } else {
    const height = quality.replace('p', '');
    args.push('-f', `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`);
    args.push('--merge-output-format', 'mp4');
  }

  args.push(url);

  // Update download status to active
  await prisma.download.update({
    where: { id: downloadId },
    data: { status: 'downloading' }
  });

  return new Promise<string>((resolve, reject) => {
    const process = execFile('yt-dlp', args);
    let outputPath = '';

    process.stdout?.on('data', async (data: string) => {
      const line = data.toString();
      console.log('[yt-dlp]', line);

      // Parse progress percentage from yt-dlp output
      const progressMatch = line.match(/(\d+\.?\d*)%/);
      if (progressMatch) {
        const progress = Math.floor(parseFloat(progressMatch[1]));
        await prisma.download.update({
          where: { id: downloadId },
          data: { progress }
        });
      }

      // Capture the output file path
      if (line.includes('Destination:')) {
        outputPath = line.split('Destination:')[1].trim();
      }
    });

    process.stderr?.on('data', (data: string) => {
      console.error('[yt-dlp error]', data.toString());
    });

    process.on('close', async (code) => {
      if (code === 0) {
        await prisma.download.update({
          where: { id: downloadId },
          data: { status: 'completed', progress: 100 }
        });
        resolve(outputPath);
      } else {
        await prisma.download.update({
          where: { id: downloadId },
          data: { status: 'failed' }
        });
        reject(new Error('yt-dlp process failed'));
      }
    });
  });
}