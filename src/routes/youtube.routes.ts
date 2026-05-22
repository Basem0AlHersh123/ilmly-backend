import { Router } from 'express';
import * as youtubeController from '../controllers/youtube.controller';

const router = Router();

// Search endpoints
router.get('/search/videos', youtubeController.searchVideos);
router.get('/search/playlists', youtubeController.searchPlaylists);
router.get('/search/channels', youtubeController.searchChannels);

// Video details
router.get('/video/:videoId', youtubeController.getVideoDetails);

// Playlist endpoints
router.get('/playlist/:playlistId', youtubeController.getPlaylistDetails);
router.get('/playlist/:playlistId/items', youtubeController.getPlaylistItems);

// Channel endpoints
router.get('/channel/:channelId', youtubeController.getChannelDetails);
router.get('/channel/:channelId/videos', youtubeController.getChannelVideos);
router.get('/channel/:channelId/playlists', youtubeController.getChannelPlaylists);

// API key management
router.post('/key/validate', youtubeController.validateApiKey);
router.post('/key/save', youtubeController.saveApiKey);
router.get('/quota', youtubeController.getQuotaStatus);
router.post('/quota/reset', youtubeController.resetQuota);

// Cache management
router.post('/cache/clear', youtubeController.clearCache);

// Search history
router.get('/history', youtubeController.getSearchHistory);
router.delete('/history', youtubeController.clearSearchHistory);
router.delete('/history/:id', youtubeController.deleteSearchHistoryItem);

// Recommendations
router.get('/recommendations', youtubeController.getRecommendations);

export default router;
