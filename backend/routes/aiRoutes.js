/**
 * AI Routes — Unified route registration for all AI endpoints.
 *
 * All routes are protected by JWT auth middleware.
 * Role-specific routes have additional role validation in their controllers.
 *
 * Route groups:
 *   /api/ai/health          — AI service health (any authenticated user)
 *   /api/ai/ping            — Groq connectivity test (Admin only)
 *   /api/ai/cache/*         — Cache management (Admin only)
 *   /api/ai/logs            — AI call logs (Admin only)
 *   /api/ai/generate-notes  — Teacher: note suggestions
 *   /api/ai/detect-weak-topics — Teacher: weak topic detection
 *   /api/ai/generate-questions — Teacher: question generation
 *   /api/ai/student/*       — Student AI features
 *   /api/ai/admin/*         — Admin AI intelligence features
 */

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { studentAIRateLimit, requireStudent } = require('../middleware/studentAIRateLimit');

// ── AI Core (health, ping, cache) ─────────────────────────────────────────────
const { getAIHealth, pingGroq, invalidateCache, invalidateUserCache } = require('../controllers/aiController');

router.get('/health',                    auth, getAIHealth);
router.post('/ping',                     auth, pingGroq);
router.delete('/cache/:testId',          auth, invalidateCache);
router.delete('/cache/user/:userId',     auth, invalidateUserCache);

// ── AI Logs ───────────────────────────────────────────────────────────────────
const { getAILogs, getAILogStats } = require('../controllers/ai-log-controller');
router.get('/logs',       auth, getAILogs);
router.get('/logs/stats', auth, getAILogStats);

// ── Teacher AI ────────────────────────────────────────────────────────────────
const {
    getNoteSuggestions, getSavedNoteSuggestions,
    detectWeakTopics, generateQuestions,
    getTopicPerformance, getQuestionBank, addBankQuestionsToTest,
} = require('../controllers/ai-teaching-controller');

router.post('/generate-notes',              auth, getNoteSuggestions);
router.get('/generate-notes/saved',         auth, getSavedNoteSuggestions);
router.post('/detect-weak-topics',          auth, detectWeakTopics);
router.post('/generate-questions',          auth, generateQuestions);
router.get('/topic-performance',            auth, getTopicPerformance);
router.get('/question-bank',                auth, getQuestionBank);
router.post('/question-bank/:bankId/add-to-test', auth, addBankQuestionsToTest);

// ── Student AI ────────────────────────────────────────────────────────────────
const {
    generateClassNotesHandler, generateStudyPlanHandler, generateDailyRoutineHandler,
    prepareNextTestHandler, assignmentHelpHandler,
    getStudentNotes, getStudentStudyPlan, getStudentRoutine, getStudentTestPrep, getAssignmentHelp,
} = require('../controllers/student-ai-controller');

const studentAI = [auth, requireStudent, studentAIRateLimit];

router.post('/student/generate-class-notes',        studentAI, generateClassNotesHandler);
router.post('/student/generate-study-plan',         studentAI, generateStudyPlanHandler);
router.post('/student/generate-daily-routine',      studentAI, generateDailyRoutineHandler);
router.post('/student/prepare-next-test',           studentAI, prepareNextTestHandler);
router.post('/student/assignment-help',             studentAI, assignmentHelpHandler);
router.get('/student/notes',                        auth, getStudentNotes);
router.get('/student/study-plan/:studentId',        auth, getStudentStudyPlan);
router.get('/student/routine/:studentId',           auth, getStudentRoutine);
router.get('/student/test-prep/:studentId/:testId', auth, getStudentTestPrep);
router.get('/student/assignment-help/:studentId',   auth, getAssignmentHelp);

// ── Admin AI Intelligence ─────────────────────────────────────────────────────
// These controllers handle their own Admin role validation internally
const adminAIRoutes = require('./adminAiRoutes');
router.use('/admin', adminAIRoutes);

module.exports = router;
