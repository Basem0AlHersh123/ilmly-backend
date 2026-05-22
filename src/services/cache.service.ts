import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CACHE_TTL_SECONDS = 3600; // 1 hour

export async function getCachedResponse(key: string): Promise<string | null> {
  const cached = await prisma.aPICache.findUnique({
    where: { key },
  });

  if (!cached) return null;

  if (new Date() > cached.expiresAt) {
    await prisma.aPICache.delete({ where: { key } });
    return null;
  }

  return cached.response;
}

export async function setCachedResponse(key: string, response: string, ttlSeconds?: number): Promise<void> {
  const expiresAt = new Date(Date.now() + (ttlSeconds || CACHE_TTL_SECONDS) * 1000);

  await prisma.aPICache.upsert({
    where: { key },
    update: { response, expiresAt },
    create: { key, response, expiresAt },
  });
}

export async function clearCache(): Promise<number> {
  const result = await prisma.aPICache.deleteMany({});
  return result.count;
}

export async function clearExpiredCache(): Promise<number> {
  const result = await prisma.aPICache.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}
