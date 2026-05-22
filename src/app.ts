import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import videoRoutes from './routes/video.routes';
import authRoutes from './routes/auth.routes';
import settingsRoutes from './routes/settings.routes';
import libraryRoutes from './routes/library.routes';
import learningRoutes from './routes/learning.routes';
import youtubeRoutes from './routes/youtube.routes';
import cookiesRoutes from './routes/cookies.routes';
import { Request, Response, NextFunction } from 'express';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: 'Too many requests, slow down.' }
});
app.use(limiter);

// Routes
app.use('/health', (_req, res) => res.json({ status: 'ok', message: 'ILMLY backend running' }));
app.use('/api/video', videoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/cookies', cookiesRoutes);

// Handle routes that don't exist
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

export default app;