import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware';
import { videoInfoSchema, downloadStartSchema } from '../validators/video.validator';
import {
  fetchVideoInfo,
  startVideoDownload,
  getDownloadProgress,
  cancelVideoDownload,
  getAllDownloadsList,
  getQueue,
  pauseVideoDownload,
  resumeVideoDownload,
} from '../controllers/video.controller';

const router = Router();
router.get('/queue', getQueue);
router.post('/info', validate(videoInfoSchema), fetchVideoInfo);
router.post('/download/start', validate(downloadStartSchema), startVideoDownload);
router.get('/download/:id/progress', getDownloadProgress);
router.post('/download/:id/cancel', cancelVideoDownload);
router.post('/download/:id/pause', pauseVideoDownload);
router.post('/download/:id/resume', resumeVideoDownload);
router.get('/downloads', getAllDownloadsList);

export default router;