import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as youtubeApi from '../services/youtube-api.service';
import * as cacheService from '../services/cache.service';

const prisma = new PrismaClient();

export async function searchVideos(req: Request, res: Response) {
  try {
    const { q, pageToken, maxResults } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const cacheKey = `search:videos:${q}:${pageToken || ''}`;
    const cached = await cacheService.getCachedResponse(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await youtubeApi.searchVideos(
      q,
      pageToken as string | undefined,
      maxResults ? parseInt(maxResults as string) : 15
    );

    // Save search history
    await prisma.searchHistory.create({
      data: { query: q },
    }).catch(() => {});

    await cacheService.setCachedResponse(cacheKey, JSON.stringify(result));

    res.json(result);
  } catch (error: any) {
    console.error('Search videos error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

export async function searchPlaylists(req: Request, res: Response) {
  try {
    const { q, pageToken, maxResults } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const cacheKey = `search:playlists:${q}:${pageToken || ''}`;
    const cached = await cacheService.getCachedResponse(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await youtubeApi.searchPlaylists(
      q,
      pageToken as string | undefined,
      maxResults ? parseInt(maxResults as string) : 15
    );

    await cacheService.setCachedResponse(cacheKey, JSON.stringify(result));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function searchChannels(req: Request, res: Response) {
  try {
    const { q, maxResults } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const cacheKey = `search:channels:${q}`;
    const cached = await cacheService.getCachedResponse(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await youtubeApi.searchChannels(
      q,
      maxResults ? parseInt(maxResults as string) : 15
    );

    await cacheService.setCachedResponse(cacheKey, JSON.stringify(result));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getVideoDetails(req: Request, res: Response) {
  try {
    const videoId = req.params.videoId as string;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const cacheKey = `video:${videoId}`;
    const cached = await cacheService.getCachedResponse(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await youtubeApi.getVideoDetails(videoId);

    if (!result) {
      return res.status(404).json({ error: 'Video not found' });
    }

    await cacheService.setCachedResponse(cacheKey, JSON.stringify(result), 86400 * 30);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPlaylistDetails(req: Request, res: Response) {
  try {
    const playlistId = req.params.playlistId as string;

    if (!playlistId) {
      return res.status(400).json({ error: 'Playlist ID is required' });
    }

    const cacheKey = `playlist:${playlistId}`;
    const cached = await cacheService.getCachedResponse(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await youtubeApi.getPlaylistDetails(playlistId);

    if (!result) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    await cacheService.setCachedResponse(cacheKey, JSON.stringify(result), 86400 * 7);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPlaylistItems(req: Request, res: Response) {
  try {
    const playlistId = req.params.playlistId as string;
    const pageToken = req.query.pageToken as string | undefined;
    const maxResults = req.query.maxResults ? parseInt(req.query.maxResults as string) : 50;

    if (!playlistId) {
      return res.status(400).json({ error: 'Playlist ID is required' });
    }

    const cacheKey = `playlistItems:${playlistId}:${pageToken || ''}`;
    const cached = await cacheService.getCachedResponse(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await youtubeApi.getPlaylistItems(playlistId, pageToken, maxResults);

    await cacheService.setCachedResponse(cacheKey, JSON.stringify(result));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getChannelDetails(req: Request, res: Response) {
  try {
    const channelId = req.params.channelId as string;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const cacheKey = `channel:${channelId}`;
    const cached = await cacheService.getCachedResponse(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await youtubeApi.getChannelDetails(channelId);

    if (!result) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    await cacheService.setCachedResponse(cacheKey, JSON.stringify(result), 86400 * 7);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getChannelVideos(req: Request, res: Response) {
  try {
    const channelId = req.params.channelId as string;
    const pageToken = req.query.pageToken as string | undefined;
    const maxResults = req.query.maxResults ? parseInt(req.query.maxResults as string) : 20;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const cacheKey = `channelVideos:${channelId}:${pageToken || ''}`;
    const cached = await cacheService.getCachedResponse(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await youtubeApi.getChannelVideos(channelId, pageToken, maxResults);

    await cacheService.setCachedResponse(cacheKey, JSON.stringify(result));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getChannelPlaylists(req: Request, res: Response) {
  try {
    const channelId = req.params.channelId as string;
    const pageToken = req.query.pageToken as string | undefined;
    const maxResults = req.query.maxResults ? parseInt(req.query.maxResults as string) : 20;

    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }

    const cacheKey = `channelPlaylists:${channelId}:${pageToken || ''}`;
    const cached = await cacheService.getCachedResponse(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await youtubeApi.getChannelPlaylists(channelId, pageToken, maxResults);

    await cacheService.setCachedResponse(cacheKey, JSON.stringify(result));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function validateApiKey(req: Request, res: Response) {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'API key is required' });
    }

    const isValid = await youtubeApi.validateApiKey(apiKey);

    res.json({ valid: isValid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function saveApiKey(req: Request, res: Response) {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'API key is required' });
    }

    const isValid = await youtubeApi.validateApiKey(apiKey);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid API key' });
    }

    let settings = await prisma.settings.findFirst();

    if (!settings) {
      settings = await prisma.settings.create({
        data: { youtubeApiKey: apiKey, onboardingComplete: true },
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: { youtubeApiKey: apiKey, onboardingComplete: true },
      });
    }

    res.json({ success: true, message: 'API key saved successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getQuotaStatus(req: Request, res: Response) {
  try {
    const status = await youtubeApi.getQuotaStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function resetQuota(req: Request, res: Response) {
  try {
    const settings = await prisma.settings.findFirst();

    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    await prisma.settings.update({
      where: { id: settings.id },
      data: { quotaUsed: 0, quotaResetDate: new Date().toDateString() },
    });

    res.json({ success: true, message: 'Quota reset successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function clearCache(req: Request, res: Response) {
  try {
    const count = await cacheService.clearCache();
    res.json({ success: true, cleared: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getSearchHistory(req: Request, res: Response) {
  try {
    const history = await prisma.searchHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function clearSearchHistory(req: Request, res: Response) {
  try {
    await prisma.searchHistory.deleteMany({});
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteSearchHistoryItem(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await prisma.searchHistory.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getRecommendations(req: Request, res: Response) {
  try {
    // Get recent search queries to base recommendations on
    const recentSearches = await prisma.searchHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { query: true },
    });

    if (recentSearches.length === 0) {
      return res.json({ results: [], nextPageToken: null });
    }

    // Use the most recent search query to get recommendations
    const query = recentSearches[0].query;
    const result = await youtubeApi.searchVideos(query, undefined, 20);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
