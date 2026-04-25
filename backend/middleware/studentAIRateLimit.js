/**
 * Simple in-memory rate limiter for Student AI endpoints.
 * Allows max 10 requests per student per 15 minutes.
 * Uses node-cache so it auto-expires without manual cleanup.
 */
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 900 }); // 15 min window

const MAX_REQUESTS = 10;

const studentAIRateLimit = (req, res, next) => {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const key = `ratelimit:${userId}`;
    const count = cache.get(key) || 0;

    if (count >= MAX_REQUESTS) {
        return res.status(429).json({
            message: `Too many AI requests. Please wait a few minutes before trying again.`,
        });
    }

    cache.set(key, count + 1);
    next();
};

/**
 * Middleware: verify the requesting user has role "Student".
 */
const requireStudent = (req, res, next) => {
    if (req.user?.role !== 'Student') {
        return res.status(403).json({ message: 'Access denied: students only.' });
    }
    next();
};

module.exports = { studentAIRateLimit, requireStudent };
