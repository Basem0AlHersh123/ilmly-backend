import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const QUOTA_COSTS: Record<string, number> = {
  search: 100,
  videos: 1,
  playlistItems: 1,
  channels: 1,
};

async function getApiKey(): Promise<string | null> {
  const settings = await prisma.settings.findFirst();
  return settings?.youtubeApiKey || null;
}

async function trackQuotaUsage(operation: string, cost: number) {
  const settings = await prisma.settings.findFirst();
  if (!settings) return;

  const today = new Date().toDateString();
  let quotaUsed = settings.quotaUsed;
  let quotaResetDate = settings.quotaResetDate;

  if (quotaResetDate !== today) {
    quotaUsed = 0;
    quotaResetDate = today;
  }

  quotaUsed += cost;

  await prisma.settings.update({
    where: { id: settings.id },
    data: { quotaUsed, quotaResetDate },
  });
}

async function makeApiRequest(
  endpoint: string,
  params: Record<string, string>,
  operation: string
): Promise<any> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('YouTube API key not configured. Please set up your API key in Settings.');
  }

  const cost = QUOTA_COSTS[operation] || 1;
  await trackQuotaUsage(operation, cost);

  const url = `${YOUTUBE_API_BASE}/${endpoint}`;
  const response = await axios.get(url, {
    params: { ...params, key: apiKey },
  });

  return response.data;
}

export interface YouTubeSearchResult {
  kind: string;
  etag: string;
  id: { kind: string; videoId?: string; playlistId?: string; channelId?: string };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
    };
    channelTitle: string;
    liveBroadcastContent: string;
    publishTime: string;
  };
}

export interface YouTubeVideoDetails {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
      standard: { url: string; width: number; height: number };
      maxres: { url: string; width: number; height: number };
    };
    channelTitle: string;
    tags: string[];
    categoryId: string;
    liveBroadcastContent: string;
    localized: { title: string; description: string };
  };
  contentDetails: {
    duration: string;
    dimension: string;
    definition: string;
    caption: string;
    licensedContent: boolean;
    projection: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    favoriteCount: string;
    commentCount: string;
  };
}

export interface YouTubePlaylistItem {
  kind: string;
  etag: string;
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
    };
    channelTitle: string;
    playlistId: string;
    position: number;
    resourceId: { kind: string; videoId: string };
    videoOwnerChannelTitle: string;
    videoOwnerChannelId: string;
  };
  contentDetails: {
    videoId: string;
    startAt: string;
    endAt: string;
    note: string;
    videoPublished: boolean;
  };
}

export interface YouTubeChannelDetails {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl: string;
    publishedAt: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
    };
    localized: { title: string; description: string };
    country: string;
  };
  contentDetails: {
    relatedPlaylists: {
      likes: string;
      uploads: string;
    };
  };
  statistics: {
    viewCount: string;
    subscriberCount: string;
    hiddenSubscriberCount: boolean;
    videoCount: string;
  };
  brandingSettings: {
    channel: {
      title: string;
      description: string;
      keywords: string;
      country: string;
    };
    image: {
      bannerExternalUrl: string;
    };
  };
}

export async function searchVideos(
  query: string,
  pageToken?: string,
  maxResults: number = 15
): Promise<{
  results: YouTubeSearchResult[];
  nextPageToken: string | null;
  totalResults: number;
}> {
  const data = await makeApiRequest('search', {
    part: 'snippet',
    q: query,

    type: 'video',
    order: 'date',
    maxResults: maxResults.toString(),
    ...(pageToken ? { pageToken } : {}),
  }, 'search');

  return {
    results: data.items || [],
    nextPageToken: data.nextPageToken || null,
    totalResults: data.pageInfo?.totalResults || 0,
  };
}

export async function searchPlaylists(
  query: string,
  pageToken?: string,
  maxResults: number = 15
): Promise<{
  results: YouTubeSearchResult[];
  nextPageToken: string | null;
}> {
  const data = await makeApiRequest('search', {
    part: 'snippet',
    q: query,
    type: 'playlist',
    maxResults: maxResults.toString(),
    ...(pageToken ? { pageToken } : {}),
  }, 'search');

  return {
    results: data.items || [],
    nextPageToken: data.nextPageToken || null,
  };
}

export async function searchChannels(
  query: string,
  maxResults: number = 15
): Promise<{
  results: YouTubeSearchResult[];
}> {
  const data = await makeApiRequest('search', {
    part: 'snippet',
    q: query,
    type: 'channel',
    maxResults: maxResults.toString(),
  }, 'search');

  return {
    results: data.items || [],
  };
}

export async function getVideoDetails(videoId: string): Promise<YouTubeVideoDetails | null> {
  const data = await makeApiRequest('videos', {
    part: 'snippet,contentDetails,statistics',
    id: videoId,
  }, 'videos');

  return data.items?.[0] || null;
}

export async function getVideoDetailsBatch(videoIds: string[]): Promise<YouTubeVideoDetails[]> {
  const data = await makeApiRequest('videos', {
    part: 'snippet,contentDetails,statistics',
    id: videoIds.join(','),
  }, 'videos');

  return data.items || [];
}

export async function getPlaylistDetails(playlistId: string): Promise<{
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    thumbnails: any;
    publishedAt: string;
  };
  contentDetails: {
    itemCount: number;
  };
} | null> {
  const data = await makeApiRequest('playlists', {
    part: 'snippet,contentDetails',
    id: playlistId,
  }, 'videos');

  return data.items?.[0] || null;
}

export async function getPlaylistItems(
  playlistId: string,
  pageToken?: string,
  maxResults: number = 50
): Promise<{
  items: YouTubePlaylistItem[];
  nextPageToken: string | null;
  totalResults: number;
}> {
  const data = await makeApiRequest('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: maxResults.toString(),
    ...(pageToken ? { pageToken } : {}),
  }, 'playlistItems');

  return {
    items: data.items || [],
    nextPageToken: data.nextPageToken || null,
    totalResults: data.pageInfo?.totalResults || 0,
  };
}

export async function getChannelDetails(channelId: string): Promise<YouTubeChannelDetails | null> {
  const data = await makeApiRequest('channels', {
    part: 'snippet,contentDetails,statistics,brandingSettings',
    id: channelId,
  }, 'channels');

  return data.items?.[0] || null;
}

export async function getChannelVideos(
  channelId: string,
  pageToken?: string,
  maxResults: number = 15
): Promise<{
  results: YouTubeSearchResult[];
  nextPageToken: string | null;
}> {
  const data = await makeApiRequest('search', {
    part: 'snippet',
    channelId,
    type: 'video',
    order: 'date',
    maxResults: maxResults.toString(),
    ...(pageToken ? { pageToken } : {}),
  }, 'search');

  return {
    results: data.items || [],
    nextPageToken: data.nextPageToken || null,
  };
}

export async function getChannelPlaylists(
  channelId: string,
  pageToken?: string,
  maxResults: number = 15
): Promise<{
  results: YouTubeSearchResult[];
  nextPageToken: string | null;
}> {
  const data = await makeApiRequest('search', {
    part: 'snippet',
    channelId,
    type: 'playlist',
    maxResults: maxResults.toString(),
    ...(pageToken ? { pageToken } : {}),
  }, 'search');

  return {
    results: data.items || [],
    nextPageToken: data.nextPageToken || null,
  };
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: 'snippet',
        id: 'dQw4w9WgXcQ',
        key: apiKey,
      },
    });
    return response.status === 200 && response.data.items?.length > 0;
  } catch {
    return false;
  }
}

export async function getQuotaStatus(): Promise<{
  used: number;
  limit: number;
  percentage: number;
  resetDate: string;
}> {
  const settings = await prisma.settings.findFirst();
  const today = new Date().toDateString();

  if (!settings || settings.quotaResetDate !== today) {
    return { used: 0, limit: 10000, percentage: 0, resetDate: today };
  }

  const used = settings.quotaUsed;
  const limit = 10000;
  const percentage = Math.round((used / limit) * 100);

  return { used, limit, percentage, resetDate: settings.quotaResetDate };
}
