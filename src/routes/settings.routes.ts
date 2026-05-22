import { Router } from 'express';
import { getSettings, updateSettings } from '../services/settings.service';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const data = await getSettings();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/', async (req, res) => {
  try {
    const data = await updateSettings(req.body);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
