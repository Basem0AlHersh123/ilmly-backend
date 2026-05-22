export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-change-this-in-production',
  maxFileSize: 500 * 1024 * 1024, // 500MB
  allowedDomains: ['youtube.com', 'youtu.be', 'www.youtube.com'],
  ytDlpPath: process.env.YTDLP_PATH || 'yt-dlp',
};