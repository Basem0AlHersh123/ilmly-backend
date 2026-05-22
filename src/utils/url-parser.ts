export interface ParsedYouTubeUrl {
  type: 'video' | 'playlist' | 'channel' | 'shorts' | 'unknown';
  id: string | null;
  playlistId?: string | null;
}

const VIDEO_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|m\.youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
];

const PLAYLIST_PATTERNS = [
  /youtube\.com\/playlist\?.*list=([a-zA-Z0-9_-]+)/,
  /youtube\.com\/watch\?.*list=([a-zA-Z0-9_-]+)/,
];

const CHANNEL_PATTERNS = [
  /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
  /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
  /youtube\.com\/@([a-zA-Z0-9_.-]+)/,
  /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
];

const SHORTS_PATTERNS = [
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

export function parseYouTubeUrl(input: string): ParsedYouTubeUrl {
  const trimmed = input.trim();

  if (!trimmed) {
    return { type: 'unknown', id: null };
  }

  // Check for playlist first (video URLs can also contain playlist IDs)
  for (const pattern of PLAYLIST_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { type: 'playlist', id: match[1] };
    }
  }

  // Check for shorts
  for (const pattern of SHORTS_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { type: 'shorts', id: match[1] };
    }
  }

  // Check for channel
  for (const pattern of CHANNEL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { type: 'channel', id: match[1] };
    }
  }

  // Check for video
  for (const pattern of VIDEO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const result: ParsedYouTubeUrl = { type: 'video', id: match[1] };

      // Also extract playlist ID if present in video URL
      const playlistMatch = trimmed.match(/list=([a-zA-Z0-9_-]+)/);
      if (playlistMatch) {
        result.playlistId = playlistMatch[1];
      }

      return result;
    }
  }

  // Check if it's just a video ID (11 characters, alphanumeric with - and _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', id: trimmed };
  }

  // Check if it's just a playlist ID
  if (/^(PL|UU|LL|OL)[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { type: 'playlist', id: trimmed };
  }

  return { type: 'unknown', id: null };
}

export function isYouTubeUrl(input: string): boolean {
  const trimmed = input.trim();
  return (
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    /^[a-zA-Z0-9_-]{11}$/.test(trimmed) ||
    /^(PL|UU|LL|OL)[a-zA-Z0-9_-]+$/.test(trimmed)
  );
}
