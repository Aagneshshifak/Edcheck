/**
 * AI Controller — Unified controller layer for all AI endpoints.
 *
 * This controller:
 *   1. Validates input
 *   2. Calls groqService (never calls Groq directly)
 *   3. Handles errors and returns structured responses
 *   4. Triggers logging (via groqService)
 *   5. Uses cache service (via groqService)
 *
 * Routes are registered in routes/aiRoutes.js
 *
 * Note: The detailed business logic (data fetching, prompt building, DB upserts)
 * lives in the feature-specific controllers (ai-teaching-controller.js,
 * student-ai-controller.js). This controller provides the unified entry point
 * and delegates to those controllers.
 */

const { groqService, GROQ_MODELS } = require('../services/groqService');
const { logger } = require('../utils/serverLogger');

// ── Error response helper ─────────────────────────────────────────────────────

function sendError(res, err) {
    if (err.statusCode === 503 || err.isGroqError) {
        return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
    }
    if (err.message === 'AI returned an unexpected response format') {
        return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
    }
    logger.error('aiController: unexpected error', { err: err.message });
    return res.status(500).json({ message: 'Internal server error' });
}

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * GET /api/ai/health
 * Returns AI service status and cache/usage stats.
 */
const getAIHealth = async (req, res) => {
    try {
        const stats = await groqService.getStats();
        return res.json({
            status: 'ok',
            groqModel: GROQ_MODELS.BALANCED,
            stats,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// ── Quick test endpoint ───────────────────────────────────────────────────────

/**
 * POST /api/ai/ping
 * Sends a minimal prompt to Groq to verify connectivity.
 * Admin only.
 */
const pingGroq = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied: Admin role required' });
        }

        const { data } = await groqService.call({
            userId:       req.user.id,
            userRole:     'admin',
            endpointName: 'ping',
            model:        GROQ_MODELS.FAST,
            systemPrompt: 'You are a helpful assistant. Respond with valid JSON only.',
            userPrompt:   'Reply with: { "status": "ok", "message": "Groq is connected" }',
            parseResponse: (content) => {
                const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                return JSON.parse(clean);
            },
        });

        return res.json({ ...data, responseTime: new Date().toISOString() });
    } catch (err) {
        return sendError(res, err);
    }
};

// ── Cache management ──────────────────────────────────────────────────────────

/**
 * DELETE /api/ai/cache/:testId
 * Invalidate all cache entries for a test. Admin only.
 */
const invalidateCache = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied: Admin role required' });
        }
        const { testId } = req.params;
        if (!testId || !/^[0-9a-fA-F]{24}$/.test(testId)) {
            return res.status(400).json({ message: 'testId must be a valid MongoDB ObjectId' });
        }
        await groqService.invalidateByTestId(testId);
        return res.json({ message: `Cache invalidated for testId=${testId}` });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * DELETE /api/ai/cache/user/:userId
 * Invalidate all cache entries for a user. Admin only.
 */
const invalidateUserCache = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied: Admin role required' });
        }
        await groqService.invalidateByUserId(req.params.userId);
        return res.json({ message: `Cache invalidated for userId=${req.params.userId}` });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getAIHealth, pingGroq, invalidateCache, invalidateUserCache };
