/**
 * Test Attempt History Routes
 * Base: /api/history  (registered in index.js)
 *
 * POST /api/history/submit                            — student submits attempt
 * GET  /api/history/student/:studentId                — student history list
 * GET  /api/history/student/:studentId/analytics      — longitudinal analytics
 * GET  /api/history/student/:studentId/export/:id     — PDF export data
 * GET  /api/history/test/:testId/results              — teacher: test attempts
 * POST /api/history/test/:testId/publish              — teacher: publish solutions
 * POST /api/history/test/:testId/ranks                — teacher: compute ranks
 * GET  /api/history/:id                               — single attempt detail
 */

'use strict';

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const {
    submitAttemptHistory,
    getStudentHistory,
    getAttemptHistoryById,
    getStudentAnalytics,
    getTestAttempts,
    publishSolutions,
    publishRanks,
    getExportData,
} = require('../controllers/testAttemptHistoryController');

router.post('/submit',                                  auth, submitAttemptHistory);
router.get('/student/:studentId',                       auth, getStudentHistory);
router.get('/student/:studentId/analytics',             auth, getStudentAnalytics);
router.get('/student/:studentId/export/:id',            auth, getExportData);
router.get('/test/:testId/results',                     auth, getTestAttempts);
router.post('/test/:testId/publish',                    auth, publishSolutions);
router.post('/test/:testId/ranks',                      auth, publishRanks);
router.get('/:id',                                      auth, getAttemptHistoryById);

module.exports = router;
