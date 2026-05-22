import { z } from 'zod';

export const videoInfoSchema = z.object({
  url: z.string().url('Must be a valid URL')
});

export const downloadStartSchema = z.object({
  url: z.string().url(),
  quality: z.string().refine(
    (q) => q === 'audio' || /^\d+p$/.test(q),
    { message: 'Quality must be like "720p" or "audio"' }
  ),
});