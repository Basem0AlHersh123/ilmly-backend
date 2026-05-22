import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── NOTES ────────────────────────────────────────────────────────────────────

export async function getNotes(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const notes = await prisma.note.findMany({
      where: { videoId: videoId as string },
      orderBy: { timestampSeconds: 'asc' }
    });
    res.json({ success: true, data: notes });
  } catch {
    res.status(500).json({ error: 'Could not fetch notes' });
  }
}

export async function createNote(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const { timestampSeconds, text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    const note = await prisma.note.create({
      data: {
        videoId: videoId as string,
        timestampSeconds: Math.floor(timestampSeconds),
        text: text.trim()
      }
    });

    res.status(201).json({ success: true, data: note });
  } catch {
    res.status(500).json({ error: 'Could not create note' });
  }
}

export async function deleteNote(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.note.delete({ where: { id: id as string } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not delete note' });
  }
}

// ─── BOOKMARKS ────────────────────────────────────────────────────────────────

export async function getBookmarks(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const bookmarks = await prisma.bookmark.findMany({
      where: { videoId: videoId as string },
      orderBy: { timestampSeconds: 'asc' }
    });
    res.json({ success: true, data: bookmarks });
  } catch {
    res.status(500).json({ error: 'Could not fetch bookmarks' });
  }
}

export async function createBookmark(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const { timestampSeconds, label } = req.body;

    const bookmark = await prisma.bookmark.create({
      data: {
        videoId: videoId as string,
        timestampSeconds: Math.floor(timestampSeconds),
        label: label || `Bookmark at ${Math.floor(timestampSeconds)}s`
      }
    });

    res.status(201).json({ success: true, data: bookmark });
  } catch {
    res.status(500).json({ error: 'Could not create bookmark' });
  }
}

export async function deleteBookmark(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.bookmark.delete({ where: { id: id as string } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not delete bookmark' });
  }
}

// ─── VOCABULARY ───────────────────────────────────────────────────────────────

export async function getVocabulary(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const words = await prisma.vocabulary.findMany({
      where: { videoId: videoId as string },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: words });
  } catch {
    res.status(500).json({ error: 'Could not fetch vocabulary' });
  }
}

export async function saveWord(req: Request, res: Response) {
  try {
    const { videoId } = req.params;
    const { word, definition, timestamp } = req.body;

    if (!word || !definition) {
      return res.status(400).json({ error: 'Word and definition are required' });
    }

    const vocab = await prisma.vocabulary.create({
      data: {
        videoId: videoId as string,
        word: word.trim(),
        definition: definition.trim(),
        timestamp: Math.floor(timestamp || 0)
      }
    });

    res.status(201).json({ success: true, data: vocab });
  } catch {
    res.status(500).json({ error: 'Could not save word' });
  }
}

export async function deleteWord(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.vocabulary.delete({ where: { id: id as string } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not delete word' });
  }
}