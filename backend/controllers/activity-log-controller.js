const ActivityLog = require('../models/activityLogSchema');

// GET /Admin/activity/:schoolId?limit=50&page=1&actorRole=&targetType=
const getActivityLogs = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const limit      = Math.min(parseInt(req.query.limit) || 50, 200);
        const page       = Math.max(parseInt(req.query.page)  || 1, 1);
        const actorRole  = req.query.actorRole  || null;
        const targetType = req.query.targetType || null;

        const filter = { schoolId };
        if (actorRole)  filter.actorRole  = actorRole;
        if (targetType) filter.targetType = targetType;

        const [logs, total] = await Promise.all([
            ActivityLog.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            ActivityLog.countDocuments(filter),
        ]);

        res.json({ logs, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getActivityLogs };
