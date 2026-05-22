import { Request, Response } from 'express';
import * as cookiesService from '../services/cookies.service';

export async function getCookiesStatus(req: Request, res: Response) {
  try {
    const status = await cookiesService.getCookiesStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function uploadCookies(req: Request, res: Response) {
  try {
    if (!req.body || !req.body.cookies) {
      return res.status(400).json({ error: 'Cookies data is required' });
    }

    const fileBuffer = Buffer.from(req.body.cookies, 'utf-8');
    const result = await cookiesService.saveCookiesFile(fileBuffer, 'cookies.txt');

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function syncCookies(req: Request, res: Response) {
  try {
    const { cookies } = req.body;

    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ error: 'Cookies array is required' });
    }

    const result = await cookiesService.syncCookiesFromExtension(cookies);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function clearCookies(req: Request, res: Response) {
  try {
    const result = await cookiesService.clearCookies();

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
