/**
 * AI Logger Utility
 *
 * Wraps any Groq API call and automatically logs:
 *   - prompt summary, response summary
 *   - token usage (prompt + completion + total)
 *   - response time in ms
 *   - success / error status
 *   - whether result came from cache
 *
 * Usage:
 *   const result = await loggedGroqCall({
 *     userId, userRole, endpointName, model,
 *     promptSummary,
 *     fn: () => groq.chat.completions.create(...)
 *   });
 */

const AILog = require('../models/aiLogSchema');
const { logger } = require('./serverLogger');

/**
 * Execute a Groq call and log the result to MongoDB.
 *
 * @param {object} opts
 * @param {string}   opts.userId        - ID of the requesting user
 * @param {string}   opts.userRole      - 'teacher' | 'student' | 'admin' | 'system'
 * @param {string}   opts.endpointName  - Logical name (e.g. 'predict-student-risk')
 * @param {string}   opts.model         - Groq model name
 * @param {string}   opts.promptSummary - First 2000 chars of the user prompt
 * @param {boolean}  [opts.fromCache]   - True if result came from cache (no Groq call)
 * @param {Function} opts.fn            - Async function that calls groq.chat.completions.create()
 *                                        Must return the raw Groq response object
 * @returns {Promise<any>} The Groq response object
 */
async function loggedGroqCall({ userId, userRole, endpointName, model, promptSummary, fromCache = false, fn }) {
    const start = Date.now();
    let success = true;
    let errorMessage = '';
    let responseSummary = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let result = null;

    try {
        result = await fn();

        // Extract token usage from Groq response
        const usage = result?.usage;
        if (usage) {
            promptTokens     = usage.prompt_tokens     || 0;
            completionTokens = usage.completion_tokens || 0;
            totalTokens      = usage.total_tokens      || 0;
        }

        // Summarise response content
        const content = result?.choices?.[0]?.message?.content ?? '';
        responseSummary = content.slice(0, 2000);

    } catch (err) {
        success = false;
        errorMessage = err.message || 'Unknown error';
        throw err; // re-throw so caller handles it
    } finally {
        const responseTimeMs = Date.now() - start;

        // Write log asynchronously — never block the response
        AILog.create({
            userId,
            userRole,
            endpointName,
            model:            model || '',
            promptSummary:    (promptSummary || '').slice(0, 2000),
            responseSummary,
            promptTokens,
            completionTokens,
            totalTokens,
            responseTimeMs,
            success,
            errorMessage,
            fromCache,
        }).catch(logErr => {
            logger.warn('ai-logger: failed to write log', { err: logErr.message });
        });
    }

    return result;
}

/**
 * Log a cache hit (no Groq call made).
 * Lightweight — just records that a cached response was served.
 */
async function logCacheHit({ userId, userRole, endpointName, model }) {
    AILog.create({
        userId,
        userRole,
        endpointName,
        model:       model || '',
        fromCache:   true,
        success:     true,
        responseTimeMs: 0,
    }).catch(() => {});
}

module.exports = { loggedGroqCall, logCacheHit };
