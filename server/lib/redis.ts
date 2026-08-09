import Redis from 'ioredis';
import { createHash } from 'crypto';

// --- REDIS CLIENT ---
let _redis: Redis | null = null;
function getRedisClient(): Redis {
    if (!_redis) {
        _redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
            lazyConnect: true,
            retryStrategy: (times) => Math.min(times * 100, 3000),
        });
        _redis.on('error', (err) => console.error('[Redis] Error:', err.message));
    }
    return _redis;
}
async function isTokenBlacklisted(token: string): Promise<boolean> {
    try {
        const hash = createHash('sha256').update(token).digest('hex');
        return (await getRedisClient().exists(`bl:${hash}`)) === 1;
    } catch { return false; }
}
async function blacklistToken(token: string, exp: number): Promise<void> {
    try {
        const hash = createHash('sha256').update(token).digest('hex');
        const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 0);
        if (ttl > 0) await getRedisClient().set(`bl:${hash}`, '1', 'EX', ttl);
    } catch (err) { console.error('[Redis] Error al blacklistear token:', err); }
}

// Invalida TODOS los tokens de un usuario emitidos hasta ahora, sin importar cuántas apps del
// ecosistema los hayan re-firmado (cada /auth/me emite un JWT nuevo con hash distinto, así que
// blacklistToken() por sí solo no alcanza para un logout real entre apps -- ver bitácora Fase 20).
// verifyToken rechaza cualquier token con iat <= este timestamp, sin importar su hash.
async function invalidateAllUserSessions(userId: string): Promise<void> {
    try {
        const now = Math.floor(Date.now() / 1000);
        await getRedisClient().set(`logout-after:${userId}`, String(now), 'EX', 30 * 24 * 60 * 60);
    } catch (err) { console.error('[Redis] Error al invalidar sesiones del usuario:', err); }
}
async function isSessionInvalidated(userId: string, iat: number | undefined): Promise<boolean> {
    if (!iat) return false;
    try {
        const logoutAfter = await getRedisClient().get(`logout-after:${userId}`);
        return logoutAfter !== null && iat <= parseInt(logoutAfter, 10);
    } catch { return false; }
}

export { getRedisClient, isTokenBlacklisted, blacklistToken, invalidateAllUserSessions, isSessionInvalidated };
