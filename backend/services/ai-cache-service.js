/**
 * AI Cache Service
 *
 * Two-layer caching for all AI endpoints:
 *   Layer 1 — node-cache (in-memory, fast, process-scoped)
 *   Layer 2 — MongoDB AICache collection (persistent, survives restarts)
 *
 * Cache flow:
 *   1. Check memory cache  → hit: return immediately
 *   2. Check MongoDB cache → hit: warm memory cache, return
 *   3. Miss: call Groq via the provided fn()
 *   4. On success: write to both MongoDB and memory cache
 *   5. On failure: do NOT cache, propagate error
 *
 * Invalidation:
 *   Call invalidateByTestId(testId) after a test attempt is submitted.
 *   This marks all related MongoDB entries isValid=false and clears memory keys.
 */

const NodeCache = require('node-cache');
const AICache   = require('../models/aiCacheSchema');
const { logger } = require('../utils/serverLogger');

// In-memory cache: TTL 6 hours, check every 10 minutes
const memCache = new NodeCache({ stdTTL: 21600, checkperiod: 600 });

// ── Memory key builder ────────────────────────────────────────────────────────

/**
 * Build a deterministic memory cache key.
 * Format: ai:<endpointName>:<userId>:<inputHash>
 */
function memKey(endpointName, userId, inputHash) {
    return `ai:${endpointName}:${String(userId)}:${inputHash}`;
}

// ── Main cache wrapper ────────────────────────────────────────────────────────

/**
 * Wrap an AI call with two-layer caching.
 *
 * @param {object} opts
 * @param {string}   opts.endpointName  - Logical endpoint name (e.g. 'predict-student-risk')
 * @param {string}   opts.userId        - ID of the requesting user
 * @param {string}   opts.userRole      - 'teacher' | 'student' | 'admin'
 * @param {object}   opts.inputObj      - The request input (will be hashed)
 * @param {string|null} opts.relatedTestId - Test ID to associate with this cache entry (for invalidation)
 * @param {Function} opts.fn            - Async function that calls Groq and returns the result
 * @returns {Promise<{ data: any, fromCache: boolean, cachedAt?: Date }>}
 */
async function withAICache({ endpointName, userId, userRole, inputObj, relatedTestId = null, fn }) {
    const inputHash = AICache.hashInput(inputObj);
    const mKey = memKey(endpointName, userId, inputHash);

    // ── Layer 1: memory cache ─────────────────────────────────────────────────
    const memHit = memCache.get(mKey);
    if (memHit !== undefined) {
        logger.info(`ai-cache: memory hit [${endpointName}] user=${userId}`);
        return { data: memHit.data, fromCache: true, cachedAt: memHit.cachedAt };
    }

    // ── Layer 2: MongoDB cache ────────────────────────────────────────────────
    try {
        const dbHit = await AICache.findOne({
            userId,
            endpointName,
            inputHash,
            isValid: true,
        }).lean();

        if (dbHit) {
            logger.info(`ai-cache: db hit [${endpointName}] user=${userId}`);
            // Warm memory cache
            memCache.set(mKey, { data: dbHit.cachedResponse, cachedAt: dbHit.createdAt });
            return { data: dbHit.cachedResponse, fromCache: true, cachedAt: dbHit.createdAt };
        }
    } catch (dbErr) {
        // DB lookup failure is non-fatal — fall through to Groq
        logger.warn(`ai-cache: db lookup failed [${endpointName}]`, { err: dbErr.message });
    }

    // ── Cache miss: call Groq ─────────────────────────────────────────────────
    logger.info(`ai-cache: miss [${endpointName}] user=${userId} — calling Groq`);
    const result = await fn(); // throws on failure — do NOT cache errors

    const now = new Date();

    // ── Write to MongoDB (async, non-blocking) ────────────────────────────────
    AICache.findOneAndUpdate(
        { userId, endpointName, inputHash },
        {
            $set: {
                userId,
                userRole,
                endpointName,
                inputHash,
                cachedResponse: result,
                relatedTestId:  relatedTestId || null,
                isValid:        true,
                createdAt:      now,
            },
        },
        { upsert: true }
    ).catch(err => logger.warn('ai-cache: db write failed', { err: err.message }));

    // ── Write to memory cache ─────────────────────────────────────────────────
    memCache.set(mKey, { data: result, cachedAt: now });

    return { data: result, fromCache: false };
}

// ── Invalidation ──────────────────────────────────────────────────────────────

/**
 * Invalidate all cache entries linked to a specific test.
 * Called after a test attempt is submitted.
 *
 * @param {string} testId
 */
async function invalidateByTestId(testId) {
    if (!testId) return;

    try {
        // Mark all related MongoDB entries as invalid
        const result = await AICache.updateMany(
            { relatedTestId: testId, isValid: true },
            { $set: { isValid: false } }
        );

        if (result.modifiedCount > 0) {
            logger.info(`ai-cache: invalidated ${result.modifiedCount} entries for testId=${testId}`);
        }

        // Clear matching memory keys (scan all keys for this testId pattern)
        // Memory keys don't store testId directly, so we clear by prefix patterns
        // that are known to be test-scoped: testprep and risk entries
        const keysToDelete = memCache.keys().filter(k =>
            k.includes(`:testprep:`) ||
            k.includes(`:predict-student-risk:`) ||
            k.includes(`:generate-study-plan:`) ||
            k.includes(`:generate-daily-routine:`)
        );
        if (keysToDelete.length > 0) {
            memCache.del(keysToDelete);
            logger.info(`ai-cache: cleared ${keysToDelete.length} memory keys after test invalidation`);
        }
    } catch (err) {
        logger.error('ai-cache: invalidation failed', { testId, err: err.message });
    }
}

/**
 * Invalidate all cache entries for a specific user.
 * Useful when a student's profile changes significantly.
 *
 * @param {string} userId
 */
async function invalidateByUserId(userId) {
    if (!userId) return;

    try {
        await AICache.updateMany(
            { userId, isValid: true },
            { $set: { isValid: false } }
        );

        // Clear memory keys for this user
        const keysToDelete = memCache.keys().filter(k => k.includes(`:${String(userId)}:`));
        if (keysToDelete.length > 0) {
            memCache.del(keysToDelete);
        }

        logger.info(`ai-cache: invalidated all entries for userId=${userId}`);
    } catch (err) {
        logger.error('ai-cache: user invalidation failed', { userId, err: err.message });
    }
}

/**
 * Get cache statistics (for admin monitoring).
 */
async function getCacheStats() {
    const memStats = memCache.getStats();
    const dbTotal   = await AICache.countDocuments({});
    const dbValid   = await AICache.countDocuments({ isValid: true });
    const dbInvalid = await AICache.countDocuments({ isValid: false });

    return {
        memory: {
            keys:    memStats.keys,
            hits:    memStats.hits,
            misses:  memStats.misses,
            ksize:   memStats.ksize,
            vsize:   memStats.vsize,
        },
        database: {
            total:   dbTotal,
            valid:   dbValid,
            invalid: dbInvalid,
        },
    };
}

module.exports = { withAICache, invalidateByTestId, invalidateByUserId, getCacheStats };
