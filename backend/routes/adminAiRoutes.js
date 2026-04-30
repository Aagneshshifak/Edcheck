/**
 * Admin AI Routes — sub-router mounted at /api/ai/admin
 *
 * All routes require JWT auth (applied by parent aiRoutes.js).
 * Admin role validation is enforced inside each controller handler.
 */

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { getAILogStats } = require('../controllers/ai-log-controller');
const { groqService } = require('../services/groqService');

// ── Admin AI Intelligence endpoints ──────────────────────────────────────────
// These are implemented in the admin-ai-intelligence-controller
// which may or may not exist depending on deployment state.
// We load it safely to avoid crashing if not yet deployed.

let adminAICtrl = null;
try {
    adminAICtrl = require('../controllers/admin-ai-intelligence-controller');
} catch (_) {
    // Controller not yet available — routes will return 501
}

function notImplemented(req, res) {
    return res.status(501).json({ message: 'Admin AI Intelligence not yet deployed on this instance.' });
}

const predictStudentRisk      = adminAICtrl?.predictStudentRisk      || notImplemented;
const analyseClassPerformance = adminAICtrl?.analyseClassPerformance || notImplemented;
const analyseTeacherPerformance = adminAICtrl?.analyseTeacherPerformance || notImplemented;
const generateSchoolSummary   = adminAICtrl?.generateSchoolSummary   || notImplemented;
const generateRecommendations = adminAICtrl?.generateRecommendations || notImplemented;

router.post('/predict-student-risk',         auth, predictStudentRisk);
router.post('/class-performance-analysis',   auth, analyseClassPerformance);
router.post('/teacher-performance-analysis', auth, analyseTeacherPerformance);
router.post('/school-performance-summary',   auth, generateSchoolSummary);
router.post('/generate-recommendations',     auth, generateRecommendations);

// Manual nightly analysis trigger
let runAdminNightlyAnalysis = null;
try {
    runAdminNightlyAnalysis = require('../services/admin-ai-scheduler').runAdminNightlyAnalysis;
} catch (_) {}

router.post('/run-nightly-analysis', auth, async (req, res) => {
    if (!runAdminNightlyAnalysis) {
        return res.status(501).json({ message: 'Admin AI scheduler not yet deployed.' });
    }
    res.json({ message: 'Admin AI nightly analysis started in background' });
    runAdminNightlyAnalysis().catch(() => {});
});

// Cache stats
router.get('/cache-stats', auth, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ message: 'Access denied: Admin role required' });
        }
        const stats = await groqService.getStats();
        return res.json(stats);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;
