const NodeCache = require("node-cache");

// Default TTL: 5 minutes. Check for expired keys every 2 minutes.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 });

/**
 * Wrap an async data-fetching function with a cache layer.
 * @param {string} key   - Cache key
 * @param {Function} fn  - Async function that returns the data
 * @param {number} [ttl] - Optional TTL override in seconds
 */
const withCache = async (key, fn, ttl) => {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const data = await fn();
    cache.set(key, data, ttl);
    return data;
};

/** Invalidate a specific key or a prefix pattern */
const invalidate = (keyOrPrefix) => {
    const keys = cache.keys().filter(k => k === keyOrPrefix || k.startsWith(keyOrPrefix));
    cache.del(keys);
};

module.exports = { cache, withCache, invalidate };
