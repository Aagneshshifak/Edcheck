/**
 * Groq AI Core Service
 *
 * Single entry point for ALL Groq API calls in the system.
 * Controllers must NEVER call groq.chat.completions.create() directly.
 *
 * Responsibilities:
 *   1. Connect to Groq API via the singleton client
 *   2. Send prompts and receive responses
 *   3. Handle errors safely (Groq SDK errors, network errors, parse errors)
 *   4. Track response time and token usage
 *   5. Save AI logs to MongoDB (non-blocking)
 *   6. Integrate with two-layer cache (memory + MongoDB)
 *
 * Usage:
 *   const { groqService } = require('./groqService');
 *
 *   const result = await groqService.call({
 *     userId, userRole, endpointName,
 *     model: GROQ_MODELS.BALANCED,
 *     systemPrompt, userPrompt,
 *     parseResponse: (content) => JSON.parse(content),
 *     cacheKey: 'ai:admin:risk:testId_abc',
 *     cacheTtl: 3600,
 *     relatedTestId: testId,
 *   });
 *   // result: { data, fromCache, cachedAt? }
 */

const { groq, GROQ_MODELS } = require('../config/groq');
const AILog  = require('../models/aiLogSchema');
const { logger } = require('../utils/serverLogger');

// ── In-memory cache (fast layer) ──────────────────────────────────────────────
const NodeCache = require('node-cache');
const memCache  = new NodeCache({ stdTTL: 21600, checkperiod: 600 }); // 6h default TTL

// ── Lazy-load MongoDB cache model to avoid circular deps ──────────────────────
let AICache = null;
function getAICache() {
    if (!AICache) AICache = require('../models/aiCacheSchema');
    return AICache;
}

// ── Error classifier ──────────────────────────────────────────────────────────
function isGroqApiError(err) {
    if (err && typeof err.status === 'number') return true;
    if (err && err.code && /^E(CONN|TIMEOUT|NOTFOUND)/.test(err.code)) return true;
    return false;
}

// ── Core call function ────────────────────────────────────────────────────────

/**
 * Make a Groq API call with full logging, caching, and error handling.
 *
 * @param {object} opts
 * @param {string}   opts.userId          - Requesting user ID (for logging/cache)
 * @param {string}   opts.userRole        - 'teacher' | 'student' | 'admin' | 'system'
 * @param {string}   opts.endpointName    - Logical name (e.g. 'predict-student-risk')
 * @param {string}   opts.model           - Groq model string (use GROQ_MODELS.*)
 * @param {string}   opts.systemPrompt    - System message content
 * @param {string}   opts.userPrompt      - User message content
 * @param {Function} opts.parseResponse   - Function(content: string) → parsed result; throws on invalid
 * @param {string}   [opts.cacheKey]      - If provided, check/store in cache
 * @param {number}   [opts.cacheTtl]      - Cache TTL in seconds (default 3600)
 * @param {string}   [opts.relatedTestId] - Test ID for cache invalidation
 * @returns {Promise<{ data: any, fromCache: boolean, cachedAt?: Date }>}
 * @throws {Error} with .isGroqError=true for Groq API errors
 * @throws {Error} with message 'AI returned an unexpected response format' for parse errors
 */
async function call({
    userId,
    userRole,
    endpointName,
    model,
    systemPrompt,
    userPrompt,
    parseResponse,
    cacheKey,
    cacheTtl = 3600,
    relatedTestId = null,
}) {
    // ── Layer 1: Memory cache ─────────────────────────────────────────────────
    if (cacheKey) {
        const memHit = memCache.get(cacheKey);
        if (memHit !== undefined) {
            logger.info(`groqService: memory cache hit [${endpointName}]`);
            _logCacheHit(userId, userRole, endpointName, model);
            return { data: memHit.data, fromCache: true, cachedAt: memHit.cachedAt };
        }

        // ── Layer 2: MongoDB cache ────────────────────────────────────────────
        try {
            const Cache = getAICache();
            const dbHit = await Cache.findOne({ cacheKey, isValid: true }).lean();
            if (dbHit) {
                logger.info(`groqService: db cache hit [${endpointName}]`);
                memCache.set(cacheKey, { data: dbHit.cachedResponse, cachedAt: dbHit.createdAt }, cacheTtl);
                _logCacheHit(userId, userRole, endpointName, model);
                return { data: dbHit.cachedResponse, fromCache: true, cachedAt: dbHit.createdAt };
            }
        } catch (dbErr) {
            logger.warn(`groqService: db cache lookup failed [${endpointName}]`, { err: dbErr.message });
        }
    }

    // ── Cache miss: call Groq ─────────────────────────────────────────────────
    const start = Date.now();
    let rawContent = '';
    let promptTokens = 0, completionTokens = 0, totalTokens = 0;
    let success = true;
    let errorMessage = '';

    try {
        const response = await groq.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt },
            ],
        });

        rawContent = response.choices?.[0]?.message?.content ?? '';
        const usage = response.usage;
        if (usage) {
            promptTokens     = usage.prompt_tokens     || 0;
            completionTokens = usage.completion_tokens || 0;
            totalTokens      = usage.total_tokens      || 0;
        }

    } catch (err) {
        success = false;
        errorMessage = err.message || 'Unknown Groq error';
        const responseTimeMs = Date.now() - start;

        _writeLog({
            userId, userRole, endpointName, model,
            promptSummary: userPrompt.slice(0, 2000),
            responseSummary: '',
            promptTokens, completionTokens, totalTokens,
            responseTimeMs, success, errorMessage, fromCache: false,
        });

        if (isGroqApiError(err)) {
            const e = new Error('AI service temporarily unavailable. Please try again.');
            e.isGroqError = true;
            e.statusCode  = 503;
            throw e;
        }
        throw err;
    }

    const responseTimeMs = Date.now() - start;

    // ── Parse response ────────────────────────────────────────────────────────
    let parsed;
    try {
        // Strip markdown code fences if present
        const clean = rawContent
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        parsed = parseResponse(clean);
    } catch (parseErr) {
        success = false;
        errorMessage = parseErr.message || 'Parse error';

        _writeLog({
            userId, userRole, endpointName, model,
            promptSummary: userPrompt.slice(0, 2000),
            responseSummary: rawContent.slice(0, 2000),
            promptTokens, completionTokens, totalTokens,
            responseTimeMs, success, errorMessage, fromCache: false,
        });

        const e = new Error('AI returned an unexpected response format');
        e.statusCode = 503;
        throw e;
    }

    // ── Write success log ─────────────────────────────────────────────────────
    _writeLog({
        userId, userRole, endpointName, model,
        promptSummary:   userPrompt.slice(0, 2000),
        responseSummary: rawContent.slice(0, 2000),
        promptTokens, completionTokens, totalTokens,
        responseTimeMs, success: true, errorMessage: '', fromCache: false,
    });

    // ── Store in cache ────────────────────────────────────────────────────────
    const now = new Date();
    if (cacheKey) {
        memCache.set(cacheKey, { data: parsed, cachedAt: now }, cacheTtl);

        try {
            const Cache = getAICache();
            Cache.findOneAndUpdate(
                { cacheKey },
                { $set: { cacheKey, userId, userRole, endpointName, cachedResponse: parsed, relatedTestId: relatedTestId || null, isValid: true, createdAt: now } },
                { upsert: true }
            ).catch(() => {});
        } catch (_) {}
    }

    return { data: parsed, fromCache: false };
}

// ── Cache invalidation ────────────────────────────────────────────────────────

/**
 * Invalidate all cache entries linked to a test ID.
 * Called after a test attempt is submitted.
 */
async function invalidateByTestId(testId) {
    if (!testId) return;
    try {
        const Cache = getAICache();
        const result = await Cache.updateMany(
            { relatedTestId: testId, isValid: true },
            { $set: { isValid: false } }
        );
        if (result.modifiedCount > 0) {
            logger.info(`groqService: invalidated ${result.modifiedCount} cache entries for testId=${testId}`);
        }
        // Clear memory keys that are test-scoped
        const keysToDelete = memCache.keys().filter(k =>
            k.includes(':risk:') || k.includes(':testprep:') ||
            k.includes(':study-plan:') || k.includes(':routine:')
        );
        if (keysToDelete.length > 0) memCache.del(keysToDelete);
    } catch (err) {
        logger.error('groqService: cache invalidation failed', { testId, err: err.message });
    }
}

/**
 * Invalidate all cache entries for a specific user.
 */
async function invalidateByUserId(userId) {
    if (!userId) return;
    try {
        const Cache = getAICache();
        await Cache.updateMany({ userId, isValid: true }, { $set: { isValid: false } });
        const keysToDelete = memCache.keys().filter(k => k.includes(String(userId)));
        if (keysToDelete.length > 0) memCache.del(keysToDelete);
    } catch (err) {
        logger.error('groqService: user cache invalidation failed', { userId, err: err.message });
    }
}

/**
 * Get cache and usage statistics.
 */
async function getStats() {
    const memStats = memCache.getStats();
    let dbStats = { total: 0, valid: 0, invalid: 0 };
    let logStats = { totalCalls: 0, totalTokens: 0, avgResponseMs: 0, errors: 0 };

    try {
        const Cache = getAICache();
        const [total, valid] = await Promise.all([
            Cache.countDocuments({}),
            Cache.countDocuments({ isValid: true }),
        ]);
        dbStats = { total, valid, invalid: total - valid };
    } catch (_) {}

    try {
        const [agg] = await AILog.aggregate([{
            $group: {
                _id: null,
                totalCalls:    { $sum: 1 },
                totalTokens:   { $sum: '$totalTokens' },
                avgResponseMs: { $avg: '$responseTimeMs' },
                errors:        { $sum: { $cond: ['$success', 0, 1] } },
            },
        }]);
        if (agg) logStats = { totalCalls: agg.totalCalls, totalTokens: agg.totalTokens, avgResponseMs: Math.round(agg.avgResponseMs || 0), errors: agg.errors };
    } catch (_) {}

    return { memory: memStats, database: dbStats, usage: logStats };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _writeLog(data) {
    AILog.create(data).catch(err =>
        logger.warn('groqService: log write failed', { err: err.message })
    );
}

function _logCacheHit(userId, userRole, endpointName, model) {
    _writeLog({
        userId, userRole, endpointName, model: model || '',
        promptSummary: '', responseSummary: '',
        promptTokens: 0, completionTokens: 0, totalTokens: 0,
        responseTimeMs: 0, success: true, errorMessage: '', fromCache: true,
    });
}

// ── Exports ───────────────────────────────────────────────────────────────────

const groqService = { call, invalidateByTestId, invalidateByUserId, getStats, GROQ_MODELS };

module.exports = { groqService, GROQ_MODELS };
