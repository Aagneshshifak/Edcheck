const AILog = require('../models/aiLogSchema');

/**
 * GET /api/ai/logs
 * Admin-only endpoint to view AI call logs.
 *
 * Query params:
 *   page        {number}  default 1
 *   limit       {number}  default 50, max 200
 *   endpoint    {string}  filter by endpointName
 *   role        {string}  filter by userRole
 *   success     {boolean} filter by success status
 *   fromDate    {string}  ISO date string
 *   toDate      {string}  ISO date string
 */
const getAILogs = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied: Admin role required' });
        }

        const page     = Math.max(1, parseInt(req.query.page)  || 1);
        const limit    = Math.min(200, parseInt(req.query.limit) || 50);
        const skip     = (page - 1) * limit;

        const filter = {};
        if (req.query.endpoint) filter.endpointName = req.query.endpoint;
        if (req.query.role)     filter.userRole     = req.query.role;
        if (req.query.success !== undefined) {
            filter.success = req.query.success === 'true';
        }
        if (req.query.fromDate || req.query.toDate) {
            filter.createdAt = {};
            if (req.query.fromDate) filter.createdAt.$gte = new Date(req.query.fromDate);
            if (req.query.toDate)   filter.createdAt.$lte = new Date(req.query.toDate);
        }

        const [logs, total] = await Promise.all([
            AILog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AILog.countDocuments(filter),
        ]);

        return res.json({
            logs,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * GET /api/ai/logs/stats
 * Aggregate stats: total calls, total tokens, avg response time, error rate.
 */
const getAILogStats = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied: Admin role required' });
        }

        const [totals, byEndpoint, recentErrors] = await Promise.all([
            AILog.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCalls:       { $sum: 1 },
                        totalTokens:      { $sum: '$totalTokens' },
                        avgResponseMs:    { $avg: '$responseTimeMs' },
                        successCount:     { $sum: { $cond: ['$success', 1, 0] } },
                        errorCount:       { $sum: { $cond: ['$success', 0, 1] } },
                        cacheHits:        { $sum: { $cond: ['$fromCache', 1, 0] } },
                    },
                },
            ]),
            AILog.aggregate([
                {
                    $group: {
                        _id:           '$endpointName',
                        calls:         { $sum: 1 },
                        totalTokens:   { $sum: '$totalTokens' },
                        avgResponseMs: { $avg: '$responseTimeMs' },
                        errors:        { $sum: { $cond: ['$success', 0, 1] } },
                    },
                },
                { $sort: { calls: -1 } },
            ]),
            AILog.find({ success: false })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('endpointName errorMessage createdAt userRole')
                .lean(),
        ]);

        return res.json({
            totals:       totals[0] || { totalCalls: 0, totalTokens: 0, avgResponseMs: 0, successCount: 0, errorCount: 0, cacheHits: 0 },
            byEndpoint,
            recentErrors,
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getAILogs, getAILogStats };
