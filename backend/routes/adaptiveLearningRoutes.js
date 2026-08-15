/**
 * Adaptive Learning Routes
 *
 * Base path: /api/adaptive  (registered in backend/index.js)
 *
 * All routes require authentication (JWT Bearer token).
 * Admin-only routes have additional role checks in controllers.
 *
 * POST /api/adaptive/attempt
 *   Submit a quiz attempt through the full adaptive pipeline.
 *   Accessible by: Student (self), Teacher, Admin
 *
 * GET /api/adaptive/profile/:studentId
 *   Get the student's current learning profile.
 *   Accessible by: Student (self), Teacher, Admin
 *
 * GET /api/adaptive/mastery/:studentId
 *   Get all topic mastery records.
 *   Query: ?subjectId=&topic=
 *
 * GET /api/adaptive/trends/:studentId
 *   Get learning trend analysis.
 *   Query: ?trendType=&subjectId=
 *
 * GET /api/adaptive/difficulty/:studentId
 *   Get latest difficulty recommendations (one per topic).
 *
 * GET /api/adaptive/difficulty/:studentId/topic/:topic/explain
 *   Get explainability trace for a specific topic recommendation.
 *
 * POST /api/adaptive/study-plan/:studentId
 *   Generate a new LLM-based personalized study plan.
 *   Body: { upcomingExams?, studyHoursPerWeek?, learningObjectives? }
 *
 * GET /api/adaptive/study-plan/:studentId
 *   Get the latest active study plan.
 *
 * GET /api/adaptive/attempt/:id
 *   Get a QuizAttemptDetail document by ID.
 *
 * GET /api/adaptive/analytics/:studentId
 *   Full analytics dump (Admin or self only).
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

// ── Post-assessment analysis (async — student analysis + study plan + staff report)
router.post('/post-assessment-analysis', auth, runPostAssessmentAnalysis);

// ── Assessment generation (blueprint-based) ───────────────────────────────
router.post('/generate-test', auth, generateAdaptiveAssessment);

// ── Staff reports ─────────────────────────────────────────────────────────────
router.get('/staff-reports/:studentId', auth, getStaffReports);

// ── Attempt detail ────────────────────────────────────────────────────────────
router.get('/attempt/:id', auth, getAttemptDetail);

// ── Full analytics (admin/self) ───────────────────────────────────────────────
router.get('/analytics/:studentId', auth, getFullAnalytics);

module.exports = router;

