import { Router } from 'express';
import * as cookiesController from '../controllers/cookies.controller';

const router = Router();

router.get('/status', cookiesController.getCookiesStatus);
router.post('/upload', cookiesController.uploadCookies);
router.post('/sync', cookiesController.syncCookies);
router.post('/clear', cookiesController.clearCookies);

export default router;
