import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getVideoInfo } from '../services/ytdlp.service';
import { addToQueue, getQueueStatus } from '../services/queue.service';
import { startDownload, cancelDownload, getAllDownloads, pauseDownload, resumeDownload } from '../services/download.service';

const prisma = new PrismaClient();

export async function fetchVideoInfo(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const info = await getVideoInfo(url);
    res.json({ success: true, data: info });
  } catch (error: any) {
    console.error('fetchVideoInfo error:', error.message);
    res.status(500).json({ error: error.message || 'Could not fetch video info. Check the URL.' });
  }
}

export async function startVideoDownload(req: Request, res: Response) {
  try {
    const { url, quality } = req.body;
    const info = await getVideoInfo(url);

    const downloadId = await addToQueue(
      url,
      info.id,
      info.title,
      info.channel,
      info.duration,
      info.thumbnail,
      quality
    );

    res.json({
      success: true,
      downloadId,
      message: 'Added to download queue'
    });
  } catch (error: any) {
    if (error.message.includes('already')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('startVideoDownload error:', error.message);
    res.status(500).json({ error: 'Could not add to queue' });
  }
}

export async function getDownloadProgress(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const download = await prisma.download.findUnique({ where: { id: id as string } });

    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
    }

    res.json({ success: true, data: download });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not fetch progress' });
  }
}

export async function cancelVideoDownload(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await cancelDownload(id as string);
    res.json({ success: true, message: 'Download cancelled' });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not cancel download' });
  }
}

export async function pauseVideoDownload(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await pauseDownload(id as string);
    res.json({ success: true, message: 'Download paused' });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not pause download' });
  }
}

export async function resumeVideoDownload(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await resumeDownload(id as string);
    res.json({ success: true, message: 'Download resumed' });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not resume download' });
  }
}

export async function getAllDownloadsList(req: Request, res: Response) {
  try {
    const downloads = await getAllDownloads();
    res.json({ success: true, data: downloads });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not fetch downloads' });
  }
}
export async function getQueue(req: Request, res: Response) {
  try {
    const queue = await getQueueStatus();
    res.json({ success: true, data: queue });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not fetch queue' });
  }
}