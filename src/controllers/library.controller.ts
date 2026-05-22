import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { getStreamUrl } from '../services/ytdlp.service';

const prisma = new PrismaClient();
const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

export async function getLibrary(req: Request, res: Response) {
  try {
    const { sort = 'newest' } = req.query;

    const orderBy = sort === 'oldest'
      ? { downloadedAt: 'asc' as const }
      : sort === 'size'
      ? { fileSize: 'desc' as const }
      : sort === 'duration'
      ? { duration: 'desc' as const }
      : sort === 'title'
      ? { title: 'asc' as const }
      : { downloadedAt: 'desc' as const };

    const videos = await prisma.video.findMany({
      where: { filePath: { not: '' } },
      orderBy,
    });

    res.json({ success: true, data: videos });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not fetch library' });
  }
}

export async function getLibraryVideo(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({
      where: { id: id as string },
      include: {
        notes: { orderBy: { timestampSeconds: 'asc' } },
        bookmarks: { orderBy: { timestampSeconds: 'asc' } },
        vocabulary: { orderBy: { createdAt: 'desc' } },
      }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ success: true, data: video });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not fetch video' });
  }
}

export async function deleteVideo(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const video = await prisma.video.findUnique({ where: { id: id as string } });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete file from disk
    if (video.filePath && fs.existsSync(video.filePath)) {
      fs.unlinkSync(video.filePath);
    }

    // Delete from database (cascades to notes, bookmarks, vocabulary)
    await prisma.video.delete({ where: { id: id as string } });

    res.json({ success: true, message: 'Video deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not delete video' });
  }
}

export async function searchLibrary(req: Request, res: Response) {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const videos = await prisma.video.findMany({
      where: {
        filePath: { not: '' },
        OR: [
          { title: { contains: q } },
          { channelName: { contains: q } },
        ]
      },
      orderBy: { downloadedAt: 'desc' }
    });

    res.json({ success: true, data: videos });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not search library' });
  }
}

export async function getFolders(req: Request, res: Response) {
  try {
    const folders = await prisma.folder.findMany({
      include: { videos: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: folders });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not fetch folders' });
  }
}

export async function createFolder(req: Request, res: Response) {
  try {
    const { name, description = '' } = req.body;

    if (!name || name.trim().length < 1) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await prisma.folder.create({
      data: { name: name.trim(), description }
    });

    res.status(201).json({ success: true, data: folder });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not create folder' });
  }
}

export async function deleteFolder(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.folder.delete({ where: { id: id as string } });
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not delete folder' });
  }
}

export async function addVideoToFolder(req: Request, res: Response) {
  try {
    const { folderId, videoId } = req.params;

    // Check if already in folder
    const existing = await prisma.folderVideo.findFirst({
      where: { folderId: folderId as string, videoId: videoId as string }
    });

    if (existing) {
      return res.status(400).json({ error: 'Video already in this folder' });
    }

    await prisma.folderVideo.create({ data: { folderId: folderId as string, videoId: videoId as string } });
    res.json({ success: true, message: 'Video added to folder' });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not add video to folder' });
  }
}

export async function removeVideoFromFolder(req: Request, res: Response) {
  try {
    const { folderId, videoId } = req.params;

    await prisma.folderVideo.deleteMany({ where: { folderId: folderId as string, videoId: videoId as string } });
    res.json({ success: true, message: 'Video removed from folder' });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not remove video from folder' });
  }
}

export async function getStorageStats(req: Request, res: Response) {
  try {
    const videos = await prisma.video.findMany({
      where: { filePath: { not: '' } },
      select: { fileSize: true }
    });

    const totalBytes = videos.reduce((sum: number, v: { fileSize: number }) => sum + v.fileSize, 0);
    const totalMB = totalBytes / (1024 * 1024);
    const totalGB = totalMB / 1024;

    res.json({
      success: true,
      data: {
        videoCount: videos.length,
        totalBytes,
        totalMB: Math.round(totalMB),
        totalGB: parseFloat(totalGB.toFixed(2)),
        displaySize: totalGB >= 1
          ? `${totalGB.toFixed(2)} GB`
          : `${Math.round(totalMB)} MB`
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not calculate storage' });
  }
}

export async function streamVideoFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({ where: { id: id as string } });

    if (!video || !video.filePath) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    let filePath = video.filePath;
    
    if (!fs.existsSync(filePath)) {
      const files = fs.readdirSync(DOWNLOAD_DIR);
      const matchingFile = files.find(f => f.startsWith(video.youtubeId));
      if (matchingFile) {
        filePath = path.join(DOWNLOAD_DIR, matchingFile);
        await prisma.video.update({
          where: { id: video.id },
          data: { filePath }
        });
      } else {
        return res.status(404).json({ error: 'File not found on server' });
      }
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': filePath.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4',
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': filePath.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error: any) {
    console.error('Stream error:', error.message);
    res.status(500).json({ error: 'Could not stream video' });
  }
}

export async function toggleFavorite(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { isFavorite } = req.body;

    const video = await prisma.video.findUnique({ where: { id: id as string } });
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await prisma.video.update({
      where: { id: id as string },
      data: { isFavorite: isFavorite === true },
    });

    res.json({ success: true, isFavorite });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not update favorite status' });
  }
}

export async function streamPreview(req: Request, res: Response) {
  try {
    const youtubeId = req.params.youtubeId as string;
    const qualityParam = typeof req.query.quality === 'string' ? req.query.quality : '720p';

    const url = `https://youtube.com/watch?v=${youtubeId}`;

    // Check cache first
    const cached = await getCachedStreamUrl(youtubeId, qualityParam);
    if (cached) {
      return res.json({ success: true, data: { url: cached, title: 'Video', youtubeId, quality: qualityParam } });
    }

    // Try requested quality, fall back through lower qualities if unavailable
    const qualityFallbacks = qualityParam === 'audio'
      ? ['audio']
      : [qualityParam, ...['1080p', '720p', '480p', '360p'].filter(q => q !== qualityParam)];

    let lastError: any;
    for (const q of qualityFallbacks) {
      try {
        const result = await getStreamUrl(url, q);
        if (result.url) {
          setCachedStreamUrl(youtubeId, q, result.url);
          return res.json({ success: true, data: { ...result, youtubeId, quality: q } });
        }
      } catch (err: any) {
        lastError = err;
        continue;
      }
    }

    console.error('Preview stream error:', lastError?.message);
    res.status(500).json({ error: lastError?.message || 'Could not get preview stream' });
  } catch (error: any) {
    console.error('Preview stream error:', error.message);
    res.status(500).json({ error: error.message || 'Could not get preview stream' });
  }
}

// ─── STREAM URL CACHE ────────────────────────────────────────────────────────
const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();
const STREAM_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getCachedStreamUrl(youtubeId: string, quality: string): Promise<string | null> {
  const cacheKey = `${youtubeId}:${quality}`;
  const cached = streamUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  return null;
}

function setCachedStreamUrl(youtubeId: string, quality: string, url: string) {
  const cacheKey = `${youtubeId}:${quality}`;
  streamUrlCache.set(cacheKey, { url, expiresAt: Date.now() + STREAM_CACHE_TTL });
}

export async function streamProxy(req: Request, res: Response) {
  const youtubeId = req.params.youtubeId as string;
  const q = (req.query.quality as string) || '720p';
  const url = `https://youtube.com/watch?v=${youtubeId}`;

  // Quality fallback chain
  const qualityFallbacks = (q as string) === 'audio'
    ? ['audio']
    : [q as string, ...['1080p', '720p', '480p', '360p', '240p', '144p'].filter(qf => qf !== q)];

  try {
    // Check cache first, try fallback chain
    let streamUrl: string | null = null;
    let usedQuality = q;

    for (const tryQuality of qualityFallbacks) {
      streamUrl = await getCachedStreamUrl(youtubeId, tryQuality);
      if (streamUrl) {
        usedQuality = tryQuality;
        break;
      }
    }

    if (!streamUrl) {
      // Try each quality in fallback chain
      for (const tryQuality of qualityFallbacks) {
        try {
          const result = await getStreamUrl(url, tryQuality);
          if (result.url) {
            streamUrl = result.url;
            usedQuality = tryQuality;
            setCachedStreamUrl(youtubeId, tryQuality, streamUrl);
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (!streamUrl) {
      return res.status(404).json({ error: 'Could not get stream URL for any quality', code: 'FORMAT_UNAVAILABLE' });
    }

    // Follow redirects and stream the response to the client
    function fetchAndForward(url: string, redirectCount = 0) {
      if (redirectCount > 10) {
        if (!res.headersSent) res.status(502).json({ error: 'Too many redirects' });
        return;
      }

      const fetcher = url.startsWith('https') ? https : http;
      const proxyReq = fetcher.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Range: req.headers.range || 'bytes=0-',
        },
      }, (proxyRes) => {
        // Follow redirects (3xx)
        if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400) {
          const location = proxyRes.headers.location;
          if (location) {
            const redirectUrl = location.startsWith('http') ? location : new URL(location, url).href;
            fetchAndForward(redirectUrl, redirectCount + 1);
            return;
          }
        }

        // Forward response headers
        const headers: Record<string, string> = {
          'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
          'Cache-Control': 'no-cache',
        };
        if (proxyRes.headers['content-range']) {
          headers['Content-Range'] = proxyRes.headers['content-range'] as string;
          headers['Accept-Ranges'] = 'bytes';
        }

        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Stream proxy error' });
        }
        res.end();
      });

      req.on('close', () => {
        proxyReq.destroy();
      });
    }

    fetchAndForward(streamUrl);
  } catch (error: any) {
    console.error('Stream proxy error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Could not stream video' });
    }
  }
}