const ActivityLog = require('../models/activityLogSchema');

/**
 * Log an activity. Non-blocking — errors are swallowed so they never break the main flow.
 */
const logActivity = async ({ schoolId, actorId, actorName, actorRole = 'Admin', action, target, targetType, details, ip }) => {
    try {
        await ActivityLog.create({ schoolId, actorId, actorName, actorRole, action, target, targetType, details, ip });
    } catch (_) { /* non-fatal */ }
};

module.exports = { logActivity };
