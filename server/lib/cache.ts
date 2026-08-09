// --- CACHÉ EN MEMORIA (TTL simple para endpoints estáticos) ---
const _cache = new Map<string, { data: unknown; expiresAt: number }>();
export function cacheGet(key: string): unknown | null {
    const entry = _cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.data;
    _cache.delete(key);
    return null;
}
export function cacheSet(key: string, data: unknown, ttlMs: number) {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
export function cacheInvalidate(key: string) { _cache.delete(key); }
