import { Router } from 'express';
import {
  getLibrary,
  getLibraryVideo,
  deleteVideo,
  searchLibrary,
  getFolders,
  createFolder,
  addVideoToFolder,
  removeVideoFromFolder,
  deleteFolder,
  getStorageStats,
  streamVideoFile,
  toggleFavorite,
  streamPreview,
  streamProxy,
} from '../controllers/library.controller';

const router = Router();

router.get('/', getLibrary);
router.get('/search', searchLibrary);
router.get('/storage', getStorageStats);
router.get('/folders', getFolders);
router.post('/folders', createFolder);
router.delete('/folders/:id', deleteFolder);
router.post('/folders/:folderId/videos/:videoId', addVideoToFolder);
router.delete('/folders/:folderId/videos/:videoId', removeVideoFromFolder);
router.patch('/:id/favorite', toggleFavorite);
router.get('/preview/:youtubeId', streamPreview);
router.get('/stream-proxy/:youtubeId', streamProxy);
router.get('/:id', getLibraryVideo);
router.get('/:id/stream', streamVideoFile);
router.delete('/:id', deleteVideo);

export default router;