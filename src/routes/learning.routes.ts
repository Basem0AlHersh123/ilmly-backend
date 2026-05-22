import { Router } from 'express';
import {
  getNotes,
  createNote,
  deleteNote,
  getBookmarks,
  createBookmark,
  deleteBookmark,
  getVocabulary,
  saveWord,
  deleteWord,
} from '../controllers/learning.controller';

const router = Router();

// Notes
router.get('/videos/:videoId/notes', getNotes);
router.post('/videos/:videoId/notes', createNote);
router.delete('/notes/:id', deleteNote);

// Bookmarks
router.get('/videos/:videoId/bookmarks', getBookmarks);
router.post('/videos/:videoId/bookmarks', createBookmark);
router.delete('/bookmarks/:id', deleteBookmark);

// Vocabulary
router.get('/videos/:videoId/vocabulary', getVocabulary);
router.post('/videos/:videoId/vocabulary', saveWord);
router.delete('/vocabulary/:id', deleteWord);

export default router;