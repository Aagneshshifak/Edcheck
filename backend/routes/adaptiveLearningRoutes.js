/**
 * Adaptive Learning Routes
 *
 * Base path: /api/adaptive  (registered in backend/index.js)
 *
 * All routes require authentication (JWT Bearer token).
 * Admin-only routes have additional role checks in controllers.
 */

'use strict';

const router = require('express').Router();
const { auth } = require('../middleware/auth');

const {
    submitAdaptiveAttempt,
    getStudentProfile,
    getTopicMastery,
    getLearningTrends,
    getDifficultyRecommendations,
    generateStudyPlan,
    getStudyPlan,
    getAttemptDetail,
    getFullAnalytics,
    explainDifficultyRec,
    submitStudyPlanFeedback,
    getStudyPlanFeedback,
    runPostAssessmentAnalysis,
    getStaffReports,
    generateAdaptiveAssessment,
} = require('../controllers/adaptiveLearningController');

const {
    getLatestStudentReport,
    getStudentReportHistory,
    getStudentWeakAreas,
    getClassAnalytics,
    getAssessmentReports,
    getReportById,
} = require('../controllers/teacherReportController');

// ── Pipeline entry point ──────────────────────────────────────────────────────
router.post('/attempt', auth, submitAdaptiveAttempt);

// ── Student profile ───────────────────────────────────────────────────────────
router.get('/profile/:studentId', auth, getStudentProfile);

// ── Mastery ───────────────────────────────────────────────────────────────────
router.get('/mastery/:studentId', auth, getTopicMastery);

// ── Trends ────────────────────────────────────────────────────────────────────
router.get('/trends/:studentId', auth, getLearningTrends);

// ── Difficulty recommendations ────────────────────────────────────────────────
router.get('/difficulty/:studentId', auth, getDifficultyRecommendations);
router.get('/difficulty/:studentId/topic/:topic/explain', auth, explainDifficultyRec);

// ── Study plan (LLM) ──────────────────────────────────────────────────────────
router.post('/study-plan/:studentId', auth, generateStudyPlan);
router.get('/study-plan/:studentId',  auth, getStudyPlan);

// ── Study plan feedback loop ──────────────────────────────────────────────────
router.post('/study-plan-feedback/:studentId', auth, submitStudyPlanFeedback);
router.get('/study-plan-feedback/:studentId',  auth, getStudyPlanFeedback);

// ── Post-assessment analysis (async) ─────────────────────────────────────────
router.post('/post-assessment-analysis', auth, runPostAssessmentAnalysis);

// ── Assessment generation (blueprint-based) ───────────────────────────────────
router.post('/generate-test', auth, generateAdaptiveAssessment);

// ── Legacy staff reports ──────────────────────────────────────────────────────
router.get('/staff-reports/:studentId', auth, getStaffReports);

// ── Teacher report routes (RBAC-protected) ────────────────────────────────────
router.get('/teacher-reports/student/:studentId/latest',    auth, getLatestStudentReport);
router.get('/teacher-reports/student/:studentId/weak-areas', auth, getStudentWeakAreas);
router.get('/teacher-reports/student/:studentId',           auth, getStudentReportHistory);
router.get('/teacher-reports/class/:classId/analytics',     auth, getClassAnalytics);
router.get('/teacher-reports/assessment/:assessmentId',     auth, getAssessmentReports);
router.get('/teacher-reports/report/:reportId',             auth, getReportById);

// ── Attempt detail ────────────────────────────────────────────────────────────
router.get('/attempt/:id', auth, getAttemptDetail);

// ── Full analytics (admin/self) ───────────────────────────────────────────────
router.get('/analytics/:studentId', auth, getFullAnalytics);

module.exports = router;
