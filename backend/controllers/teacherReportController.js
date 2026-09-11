/**
 * TeacherReportController
 *
 * HTTP layer for post-assessment teacher reports.
 * Enforces RBAC: a teacher may only access reports for students
 * assigned to that teacher's class/subject.
 *
 * Routes (registered in adaptiveLearningRoutes.js under /api/adaptive):
 *   GET /teacher-reports/student/:studentId/latest
 *   GET /teacher-reports/student/:studentId
 *   GET /teacher-reports/student/:studentId/weak-areas
 *   GET /teacher-reports/class/:classId/analytics
 *   GET /teacher-reports/assessment/:assessmentId
 */

'use strict';

const mongoose = require('mongoose');
const StaffStudentReport = require('../models/staffStudentReportSchema');
const TopicMastery       = require('../models/adaptiveLearning/topicMasterySchema');
const staffReportService = require('../services/staffReportingService');
const { logger }         = require('../utils/serverLogger');

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function sendError(res, status, message) {
    return res.status(status).json({ success: false, error: { message, status } });
}

/**
 * Verify that the requesting teacher has access to the given student's reports.
 * A teacher is authorized if:
 *   (a) they created at least one assessment this student attempted, OR
 *   (b) the student belongs to a class assigned to this teacher
 *
 * We check (a) by looking for any StaffStudentReport where staffId = teacherId and studentId matches.
 * This is the simplest check that doesn't require joining across schemas.
 */
async function authorizeTeacherForStudent(teacherId, studentId) {
    const count = await StaffStudentReport.countDocuments({
        staffId: teacherId,
        studentId,
    });
    return count > 0;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/adaptive/teacher-reports/student/:studentId/latest
 *
 * Returns the most recent report for the student.
 * Auth: Teacher who owns the student's reports.
 */
const getLatestStudentReport = async (req, res) => {
    try {
        const teacherId = req.user?.id || req.user?._id;
        const { studentId } = req.params;

        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        // RBAC check
        const authorized = await authorizeTeacherForStudent(teacherId, studentId);
        if (!authorized) return sendError(res, 403, 'Access denied: student not assigned to this teacher');

        const report = await staffReportService.getLatestReport(teacherId, studentId);
        if (!report) return sendError(res, 404, 'No report found for this student');

        return res.status(200).json({ success: true, data: report });
    } catch (err) {
        logger.error('TeacherReportController: getLatestStudentReport failed', { error: err.message });
        return sendError(res, 500, 'Internal server error');
    }
};

/**
 * GET /api/adaptive/teacher-reports/student/:studentId
 *
 * Returns paginated report history for the student.
 * Query params: ?limit=20&subjectId=
 */
const getStudentReportHistory = async (req, res) => {
    try {
        const teacherId = req.user?.id || req.user?._id;
        const { studentId } = req.params;
        const { limit = 20, subjectId } = req.query;

        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const authorized = await authorizeTeacherForStudent(teacherId, studentId);
        if (!authorized) return sendError(res, 403, 'Access denied: student not assigned to this teacher');

        const reports = await staffReportService.getStudentReports(teacherId, studentId, {
            limit: Math.min(parseInt(limit) || 20, 50),
            subjectId,
        });

        return res.status(200).json({ success: true, count: reports.length, data: reports });
    } catch (err) {
        logger.error('TeacherReportController: getStudentReportHistory failed', { error: err.message });
        return sendError(res, 500, 'Internal server error');
    }
};

/**
 * GET /api/adaptive/teacher-reports/student/:studentId/weak-areas
 *
 * Returns merged weak areas from the last 5 reports (deduplicated, highest priority).
 */
const getStudentWeakAreas = async (req, res) => {
    try {
        const teacherId = req.user?.id || req.user?._id;
        const { studentId } = req.params;

        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const authorized = await authorizeTeacherForStudent(teacherId, studentId);
        if (!authorized) return sendError(res, 403, 'Access denied: student not assigned to this teacher');

        const weakAreas = await staffReportService.getWeakAreasSummary(teacherId, studentId);

        return res.status(200).json({ success: true, count: weakAreas.length, data: weakAreas });
    } catch (err) {
        logger.error('TeacherReportController: getStudentWeakAreas failed', { error: err.message });
        return sendError(res, 500, 'Internal server error');
    }
};

/**
 * GET /api/adaptive/teacher-reports/class/:classId/analytics
 *
 * Returns class-level analytics summary.
 * Lists critical students, weakest concepts across the class.
 */
const getClassAnalytics = async (req, res) => {
    try {
        const teacherId = req.user?.id || req.user?._id;
        const { classId } = req.params;

        if (!isValidObjectId(classId)) return sendError(res, 400, 'Invalid classId');

        // Verify teacher owns at least one report for this class
        const count = await StaffStudentReport.countDocuments({ staffId: teacherId, classId });
        if (count === 0) return sendError(res, 403, 'Access denied: class not assigned to this teacher');

        const analytics = await staffReportService.getClassAnalytics(teacherId, classId);
        if (!analytics) return sendError(res, 404, 'No analytics data found for this class');

        return res.status(200).json({ success: true, data: analytics });
    } catch (err) {
        logger.error('TeacherReportController: getClassAnalytics failed', { error: err.message });
        return sendError(res, 500, 'Internal server error');
    }
};

/**
 * GET /api/adaptive/teacher-reports/assessment/:assessmentId
 *
 * Returns all reports for an assessment (teacher's view only).
 */
const getAssessmentReports = async (req, res) => {
    try {
        const teacherId = req.user?.id || req.user?._id;
        const { assessmentId } = req.params;

        if (!isValidObjectId(assessmentId)) return sendError(res, 400, 'Invalid assessmentId');

        const reports = await staffReportService.getAssessmentReports(assessmentId, teacherId);
        return res.status(200).json({ success: true, count: reports.length, data: reports });
    } catch (err) {
        logger.error('TeacherReportController: getAssessmentReports failed', { error: err.message });
        return sendError(res, 500, 'Internal server error');
    }
};

/**
 * GET /api/adaptive/teacher-reports/report/:reportId
 *
 * Returns a single report by ID (teacher must own it).
 */
const getReportById = async (req, res) => {
    try {
        const teacherId = req.user?.id || req.user?._id;
        const { reportId } = req.params;

        if (!isValidObjectId(reportId)) return sendError(res, 400, 'Invalid reportId');

        const report = await StaffStudentReport.findOne({ _id: reportId, staffId: teacherId }).lean();
        if (!report) return sendError(res, 404, 'Report not found');

        return res.status(200).json({ success: true, data: report });
    } catch (err) {
        logger.error('TeacherReportController: getReportById failed', { error: err.message });
        return sendError(res, 500, 'Internal server error');
    }
};

module.exports = {
    getLatestStudentReport,
    getStudentReportHistory,
    getStudentWeakAreas,
    getClassAnalytics,
    getAssessmentReports,
    getReportById,
};
