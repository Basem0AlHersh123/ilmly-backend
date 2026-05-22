import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { sanitizeYouTubeUrl } from '../utils/sanitize';
import { getCookiesFilePathForYtDlp } from './cookies.service';
const execFileAsync = promisify(execFile);

export interface VideoInfo {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  formats: { quality: string; formatId: string; filesize: number }[];
}

function runYtDlp(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

export function getNodePath(): string | null {
  const denoPath = path.join(process.cwd(), 'deno.exe');
  if (fs.existsSync(denoPath)) return denoPath;

  const candidates = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const { execSync } = require('child_process');
    const where = execSync('where node', { encoding: 'utf8' }).trim();
    if (where) return where.split('\n')[0].trim();
  } catch {}
  return null;
}

function getYtDlpArgs(): string[] {
  const args = ['--dump-json', '--no-playlist'];
  const runtimePath = getNodePath();
  if (runtimePath) {
    const runtimeName = runtimePath.endsWith('deno.exe') ? 'deno' : 'node';
    args.push('--js-runtimes', `${runtimeName}:${runtimePath}`);
  } else {
    args.push('--js-runtimes', 'node');
  }
  const cookiesPath = getCookiesFilePathForYtDlp();
  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }
  return args;
}

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  const cleanUrl = sanitizeYouTubeUrl(url);
  const baseArgs = getYtDlpArgs();

  const { stdout, stderr } = await runYtDlp([...baseArgs, cleanUrl]);

  if (stderr && stderr.includes('Sign in to confirm')) {
    throw new Error('YouTube requires authentication. Close Chrome, then run: yt-dlp --cookies-from-browser chrome --cookies cookies.txt --skip-download https://youtube.com in the backend folder');
  }

  const data = JSON.parse(stdout);

  const formats = (data.formats || [])
    .filter((f: any) => f.height || f.acodec !== 'none')
    .map((f: any) => ({
      quality: f.height ? `${f.height}p` : 'audio',
      formatId: f.format_id,
      filesize: f.filesize || 0,
    }))
    .filter((f: any, i: number, arr: any[]) =>
      arr.findIndex(x => x.quality === f.quality) === i
    );

  return {
    id: data.id,
    title: data.title,
    channel: data.channel || data.uploader,
    duration: data.duration,
    thumbnail: data.thumbnail,
    formats,
  };
}

export async function getStreamUrl(url: string, quality: string): Promise<{ url: string; title: string }> {
  const cleanUrl = sanitizeYouTubeUrl(url);
  const nodePath = getNodePath();
  const cookiesPath = getCookiesFilePathForYtDlp();

  const height = quality.replace('p', '');
  const args = [
    '--no-playlist',
    '--format', quality === 'audio'
      ? 'bestaudio'
      : `22/18/best[height<=${height}]`,
    '--get-url',
    '--quiet',
  ];

  if (nodePath) {
    const runtimeName = nodePath.endsWith('deno.exe') ? 'deno' : 'node';
    args.push('--js-runtimes', `${runtimeName}:${nodePath}`);
  }
  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }
  args.push(cleanUrl);

  const { stdout } = await runYtDlp(args);
  const streamUrl = stdout.trim().split('\n').pop() || '';

  // Get title
  const infoArgs = ['--dump-json', '--no-playlist', '--skip-download', cleanUrl];
  if (nodePath) {
    const runtimeName = nodePath.endsWith('deno.exe') ? 'deno' : 'node';
    infoArgs.push('--js-runtimes', `${runtimeName}:${nodePath}`);
  }
  if (cookiesPath) {
    infoArgs.push('--cookies', cookiesPath);
  }

  try {
    const { stdout: infoStdout } = await runYtDlp(infoArgs);
    const data = JSON.parse(infoStdout);
    return { url: streamUrl, title: data.title };
  } catch {
    return { url: streamUrl, title: 'Video' };
  }
}

// ─── PROGRESSIVE STREAMING PIPE ──────────────────────────────────────────────
export function pipeVideoStream(
  youtubeUrl: string,
  quality: string,
  res: any,
  onError: (err: Error) => void
): () => void {
  const cleanUrl = sanitizeYouTubeUrl(youtubeUrl);
  const nodePath = getNodePath();
  const cookiesPath = getCookiesFilePathForYtDlp();

  const format = quality === 'audio'
    ? 'bestaudio/best'
    : `22/best[height<=${quality.replace('p', '')}]`;

  const args = [
    '--no-playlist',
    '--format', format,
    '-o', '-',
    '--quiet',
    '--no-warnings',
  ];

  if (nodePath) {
    const runtimeName = nodePath.endsWith('deno.exe') ? 'deno' : 'node';
    args.push('--js-runtimes', `${runtimeName}:${nodePath}`);
  }
  if (cookiesPath) {
    args.push('--cookies', cookiesPath);
  }
  args.push(cleanUrl);

  const child = spawn('yt-dlp', args, { windowsHide: true });

  let headerSent = false;
  let stderrBuf = '';

  child.stderr?.on('data', (data: Buffer) => {
    stderrBuf += data.toString();
  });

  child.stdout?.on('data', (data: Buffer) => {
    if (!headerSent) {
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-cache',
        'Accept-Ranges': 'bytes',
        'Transfer-Encoding': 'chunked',
      });
      headerSent = true;
    }
    res.write(data);
  });

  child.on('close', (code) => {
    if (!headerSent) {
      // yt-dlp failed before producing any output
      onError(new Error(stderrBuf || `yt-dlp exited with code ${code}`));
      return;
    }
    res.end();
  });

  child.on('error', (err) => {
    if (!headerSent) {
      onError(err);
    }
    res.end();
  });

  // Return cleanup function
  return () => {
    child.kill('SIGTERM');
  };
}
