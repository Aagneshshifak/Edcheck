const router = require('express').Router();
const path = require('path');
const { auth } = require('../middleware/auth');

// Health check endpoint for Render
router.get('/', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        message: 'School Management API is running',
        timestamp: new Date().toISOString()
    });
});

const { adminRegister, adminLogIn, getAdminDetail, updateAdmin, updateAdminPassword } = require('../controllers/admin-controller.js');
const { sclassCreate, sclassList, deleteSclass, deleteSclasses, getSclassDetail, getSclassStudents } = require('../controllers/class-controller.js');
const { complainCreate, complainList } = require('../controllers/complain-controller.js');
const { noticeCreate, noticeList, deleteNotices, deleteNotice, updateNotice } = require('../controllers/notice-controller.js');
const {
    studentRegister, studentLogIn, getStudents, getStudentDetail,
    deleteStudents, deleteStudent, updateStudent, studentAttendance,
    deleteStudentsByClass, updateExamResult,
    clearAllStudentsAttendanceBySubject, clearAllStudentsAttendance,
    removeStudentAttendanceBySubject, removeStudentAttendance
} = require('../controllers/student_controller.js');
const { subjectCreate, classSubjects, deleteSubjectsByClass, getSubjectDetail, deleteSubject, freeSubjectList, allSubjects, deleteSubjects } = require('../controllers/subject-controller.js');
const { teacherRegister, teacherLogIn, getTeachers, getTeacherDetail, deleteTeachers, deleteTeachersByClass, deleteTeacher, updateTeacherSubject, teacherAttendance } = require('../controllers/teacher-controller.js');
const { parentRegister, parentLogIn, getParentDetail, getParentChildren, verifyParentStudent, getParents, updateParent, deleteParent, addChildToParent } = require('../controllers/parent-controller.js');
const {
    createAssignment, getAssignmentsByClass, getAssignmentsBySubject,
    getAssignmentsByTeacher, deleteAssignment, submitAssignment,
    getStudentSubmissions, getAssignmentSubmissions, gradeSubmission
} = require('../controllers/assignment-controller.js');
const { getAttendanceAnalytics } = require('../controllers/attendanceAnalyticsController.js');
const { getUpcomingDeadlines } = require('../controllers/deadlines-controller.js');
const { getStudentProgress } = require('../controllers/progress-controller.js');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notification-controller.js');
const { streamNotifications } = require('../controllers/notification-controller.js');
const upload = require('../middleware/upload.js');

// Use Cloudinary if configured, otherwise fall back to local disk
const cloudinaryUpload = process.env.CLOUDINARY_CLOUD_NAME
    ? require('../middleware/cloudinaryUpload.js')
    : upload;
const { getSchoolAssignments } = require('../controllers/admin-assignment-controller.js');
const { getSchoolTests, adminCreateTest, toggleTestStatus } = require('../controllers/admin-test-controller.js');
const { getSchoolAttendance, getClassAttendance, getStudentAttendance } = require('../controllers/admin-attendance-controller.js');
const { sendNotification, getSentNotifications, deleteNotification, previewRecipients } = require('../controllers/admin-notification-controller.js');
const { getAnalyticsOverview, getLeaderboard, getSubjectDifficulty, getTeacherPerformance, getStudentRisk, getGradeDistribution, getCohortProgression, getRiskTrends, getParentEngagement } = require('../controllers/admin-analytics-controller.js');
const { getStudentPerformance, getClassAttendanceReport, getTeacherActivity, getAssignmentCompletion } = require('../controllers/admin-report-controller.js');
const { createTest, getTestsByClass, getTestsForStudent, updateTest, deleteTest } = require('../controllers/test-controller.js');
const { submitAttempt, getAttemptsByTest, getAttemptsByStudent, getAttemptById } = require('../controllers/test-attempt-controller.js');

const { addTeacher, updateTeacher, removeTeacher, getTeacherPerformance: getTeacherIndividualPerformance, bulkDeleteTeachers, updateTeacherStatus, resetTeacherPassword } = require('../controllers/admin-teacher-controller.js');
const { addClass, updateClass, removeClass, getClassDetail, toggleClassStatus } = require('../controllers/admin-class-controller.js');
const { recomputeClassAnalytics, getClassAnalytics, getSchoolAnalytics } = require('../controllers/admin-analytics-class-controller.js');
const { addStudent: adminAddStudent, updateStudent: adminUpdateStudent, removeStudent, getStudentPerformance: adminGetStudentPerf, bulkDeleteStudents, updateStudentStatus, resetStudentPassword, enrollStudent, unenrollStudent } = require('../controllers/admin-student-controller.js');

const { exportStudents, exportTeachers, exportClasses, exportTestResults, getImportHistory, getOrphans, deleteOrphans } = require('../controllers/admin-data-controller.js');
const { getActivityLogs } = require('../controllers/activity-log-controller.js');
const { bulkUploadStudents } = require('../controllers/bulk-upload-controller.js');
const { getAlerts } = require('../controllers/alerts-controller.js');
const requireFeature = require('../middleware/requireFeature');

// ── Admin — Activity Logs ─────────────────────────────────────────────────────
router.get('/Admin/activity/:schoolId', auth, getActivityLogs);

// ── Admin — Data Management ───────────────────────────────────────────────────
router.get('/Admin/data/export/students/:schoolId', auth, exportStudents);
router.get('/Admin/data/export/teachers/:schoolId', auth, exportTeachers);
router.get('/Admin/data/export/classes/:schoolId', auth, exportClasses);
router.get('/Admin/data/export/testResults/:schoolId', auth, exportTestResults);
router.get('/Admin/data/importHistory/:schoolId', auth, getImportHistory);
router.get('/Admin/data/orphans/:schoolId', auth, getOrphans);
router.delete('/Admin/data/orphans/:schoolId', auth, deleteOrphans);

// ── Admin — Real-time Alerts ──────────────────────────────────────────────────
router.get('/Admin/alerts/:schoolId', auth, getAlerts);

// ── Admin — Bulk Upload ───────────────────────────────────────────────────────
router.post('/Admin/bulk/students', auth, upload.single('file'), bulkUploadStudents);

const { addSubject, removeSubject, getSubjectsDetail, updateTopics, assignTeacher, updateSubject, assignSubjectToClass, unassignSubjectFromClass } = require('../controllers/admin-subject-controller.js');

// ── Admin — Subject Management ────────────────────────────────────────────────
router.post('/Admin/subjects/add', auth, addSubject);
router.delete('/Admin/subjects/:id', auth, removeSubject);
router.put('/Admin/subjects/:id', auth, updateSubject);
router.get('/Admin/subjects/detail/:schoolId', auth, getSubjectsDetail);
router.put('/Admin/subjects/:id/topics', auth, updateTopics);
router.put('/Admin/subjects/:id/teacher', auth, assignTeacher);
router.post('/Admin/subjects/:id/assign-class', auth, assignSubjectToClass);
router.delete('/Admin/subjects/:id/assign-class', auth, unassignSubjectFromClass);

// ── Admin — Test Management ───────────────────────────────────────────────────
router.post('/Admin/tests/create', auth, adminCreateTest);
router.put('/Admin/tests/:id/toggle', auth, toggleTestStatus);

// ── Admin — Teacher Management ────────────────────────────────────────────────
router.post('/Admin/teacher/add', auth, addTeacher);
router.put('/Admin/teacher/:id', auth, updateTeacher);
router.delete('/Admin/teacher/:id', auth, removeTeacher);
router.get('/Admin/teacher/:id/performance', auth, getTeacherIndividualPerformance);
router.delete('/Admin/teachers/bulk', auth, bulkDeleteTeachers);
router.put('/Admin/teacher/:id/status', auth, updateTeacherStatus);

// ── Teacher — Class Insights ──────────────────────────────────────────────────
const { getClassInsights } = require('../controllers/teacher-insights-controller');
router.get('/Teacher/class/:classId/insights', auth, getClassInsights);
router.post('/Admin/teacher/:id/resetPassword', auth, resetTeacherPassword);

// ── Class API ─────────────────────────────────────────────────────────────────
const { createClass, getAllClasses, getClassById, updateClassById, deleteClassById, getClassTree, checkClassIntegrity } = require('../controllers/class-api-controller.js');
router.post('/api/class/create', auth, createClass);
router.get('/api/class/all', auth, getAllClasses);
router.get('/api/class/:id/tree', auth, getClassTree);
router.get('/api/class/:id/integrity', auth, checkClassIntegrity);
router.get('/api/class/:id', auth, getClassById);
router.put('/api/class/update/:id', auth, updateClassById);
router.delete('/api/class/delete/:id', auth, deleteClassById);

// ── Admin — Class Management ──────────────────────────────────────────────────
router.post('/Admin/class/add', auth, addClass);
router.put('/Admin/class/:id', auth, updateClass);
router.delete('/Admin/class/:id', auth, removeClass);
router.get('/Admin/class/:id/detail', auth, getClassDetail);
router.put('/Admin/class/:id/status', auth, toggleClassStatus);
router.post('/Admin/class/:id/analytics/recompute', auth, recomputeClassAnalytics);
router.get('/Admin/class/:id/analytics', auth, getClassAnalytics);

// ── Admin — Student Management ────────────────────────────────────────────────
router.post('/Admin/student/add', adminAddStudent);
router.put('/Admin/student/:id', adminUpdateStudent);
router.delete('/Admin/student/:id', removeStudent);
router.get('/Admin/student/:id/performance', adminGetStudentPerf);
router.delete('/Admin/students/bulk', bulkDeleteStudents);
router.put('/Admin/student/:id/status', updateStudentStatus);
router.post('/Admin/student/:id/resetPassword', resetStudentPassword);
router.post('/Admin/student/:id/enroll',   enrollStudent);
router.delete('/Admin/student/:id/enroll', unenrollStudent);

const { getDashboardSummary } = require('../controllers/admin-dashboard-controller.js');
const { getHealthMetrics } = require('../controllers/admin-health-controller');
const { getConfig, updateConfig } = require('../controllers/admin-config-controller');
const { getConfig: getTimetableConfig, createDayTimetable, getDayTimetable, getWeeklyTimetable, updatePeriod, deleteDayTimetable, markTeacherAttendance, getTeacherAttendance, getTeacherDaySchedule } = require('../controllers/timetable-controller.js');
const { getSubstitutesByClassDate, getSubstitutesByTeacher } = require('../controllers/substitute-controller.js');
const { autoGenerateTimetables } = require('../controllers/timetable-generator-controller.js');

// ── Admin — Dashboard summary ─────────────────────────────────────────────────
router.get('/Admin/dashboard/:schoolId', auth, getDashboardSummary);

// ── Admin — Health metrics ────────────────────────────────────────────────────
router.get('/Admin/health/:schoolId', auth, getHealthMetrics);

// ── Admin — School config ─────────────────────────────────────────────────────
router.get('/Admin/config/:schoolId', auth, getConfig);
router.put('/Admin/config/:schoolId', auth, updateConfig);

// ── Admin ────────────────────────────────────────────────────────────────────
router.post('/AdminReg', adminRegister);
router.post('/AdminLogin', adminLogIn);
router.get("/Admin/:id", auth, getAdminDetail);
router.put("/Admin/:id/password", auth, updateAdminPassword);
router.put("/Admin/:id", auth, cloudinaryUpload.single('logo'), updateAdmin);

// ── Student ──────────────────────────────────────────────────────────────────
router.post('/StudentReg', studentRegister);
router.post('/StudentLogin', studentLogIn);
router.get("/Students/:id", auth, getStudents);
router.get("/Student/:id", auth, getStudentDetail);
router.delete("/Students/:id", auth, deleteStudents);
router.delete("/StudentsClass/:id", auth, deleteStudentsByClass);
router.delete("/Student/:id", auth, deleteStudent);
router.put("/Student/:id", auth, updateStudent);
router.put('/UpdateExamResult/:id', auth, updateExamResult);
router.put('/StudentAttendance/:id', auth, studentAttendance);
router.put('/RemoveAllStudentsSubAtten/:id', auth, clearAllStudentsAttendanceBySubject);
router.put('/RemoveAllStudentsAtten/:id', auth, clearAllStudentsAttendance);
router.put('/RemoveStudentSubAtten/:id', auth, removeStudentAttendanceBySubject);
router.put('/RemoveStudentAtten/:id', auth, removeStudentAttendance);
router.get('/StudentProgress/:studentId', auth, getStudentProgress);

// ── Teacher ──────────────────────────────────────────────────────────────────
router.post('/TeacherReg', teacherRegister);
router.post('/TeacherLogin', teacherLogIn);
router.get("/Teachers/:id", auth, getTeachers);
router.get("/Teacher/:id", auth, getTeacherDetail);
router.delete("/Teachers/:id", auth, deleteTeachers);
router.delete("/TeachersClass/:id", auth, deleteTeachersByClass);
router.delete("/Teacher/:id", auth, deleteTeacher);
router.put("/TeacherSubject", auth, updateTeacherSubject);
router.post('/TeacherAttendance/:id', auth, teacherAttendance);

// ── Parent ───────────────────────────────────────────────────────────────────
router.post('/ParentReg', parentRegister);
router.post('/ParentLogin', parentLogIn);
router.get("/Parents/:id", auth, getParents);
router.get("/Parent/children/:parentId", auth, getParentChildren);
router.get("/Parent/:parentId/student/:studentId/verify", auth, verifyParentStudent);
router.get("/Parent/:id", auth, getParentDetail);
router.put("/Parent/:id", auth, updateParent);
router.delete("/Parent/:id", auth, deleteParent);
router.put("/ParentAddChild", auth, addChildToParent);

// ── Notice ───────────────────────────────────────────────────────────────────
router.post('/NoticeCreate', auth, cloudinaryUpload.array('attachments', 5), noticeCreate);
router.get('/NoticeList/:id', auth, noticeList);
router.delete("/Notices/:id", auth, deleteNotices);
router.delete("/Notice/:id", auth, deleteNotice);
router.put("/Notice/:id", auth, updateNotice);

// ── Complain (legacy) ────────────────────────────────────────────────────────
router.post('/ComplainCreate', complainCreate);
router.get('/ComplainList/:id', complainList);

// ── Class ────────────────────────────────────────────────────────────────────
router.post('/SclassCreate', auth, sclassCreate);
router.get('/SclassList/:id', auth, sclassList);
router.get("/Sclass/Students/:id", auth, getSclassStudents);
router.get("/Sclass/:id", auth, getSclassDetail);
router.delete("/Sclasses/:id", auth, deleteSclasses);
router.delete("/Sclass/:id", auth, deleteSclass);

// ── Subject ──────────────────────────────────────────────────────────────────
router.post('/SubjectCreate', auth, subjectCreate);
router.get('/AllSubjects/:id', auth, allSubjects);
router.get('/ClassSubjects/:id', auth, classSubjects);
router.get('/FreeSubjectList/:id', auth, freeSubjectList);
router.get("/Subject/:id", auth, getSubjectDetail);
router.delete("/Subject/:id", auth, deleteSubject);
router.delete("/Subjects/:id", auth, deleteSubjects);
router.delete("/SubjectsClass/:id", auth, deleteSubjectsByClass);

// ── Admin — Assignment oversight ──────────────────────────────────────────────
router.get('/Admin/assignments/:schoolId', auth, getSchoolAssignments);

// ── Admin — Test oversight ────────────────────────────────────────────────────
router.get('/Admin/tests/:schoolId', auth, getSchoolTests);

// ── Admin — Attendance reporting ──────────────────────────────────────────────
router.get('/Admin/attendance/school/:schoolId', auth, getSchoolAttendance);
router.get('/Admin/attendance/class/:classId', auth, getClassAttendance);
router.get('/Admin/attendance/student/:studentId', auth, getStudentAttendance);

// ── Admin — Analytics ─────────────────────────────────────────────────────────
router.get('/Admin/analytics/overview/:schoolId', auth, getAnalyticsOverview);
router.get('/Admin/analytics/leaderboard/:schoolId', auth, requireFeature('leaderboard'), getLeaderboard);
router.get('/Admin/analytics/subjectDifficulty/:schoolId', auth, getSubjectDifficulty);
router.get('/Admin/analytics/teachers/:schoolId', auth, getTeacherPerformance);
router.get('/Admin/analytics/risk/:schoolId', auth, getStudentRisk);
router.get('/Admin/analytics/gradeDistribution/:schoolId', auth, getGradeDistribution);
router.get('/Admin/analytics/cohortProgression/:schoolId', auth, getCohortProgression);
router.get('/Admin/analytics/riskTrends/:schoolId', auth, getRiskTrends);
router.get('/Admin/analytics/parentEngagement/:schoolId', auth, getParentEngagement);
router.get('/Admin/school/:schoolId/analytics', auth, getSchoolAnalytics);

// ── Admin — Reports ───────────────────────────────────────────────────────────
router.get('/Admin/reports/studentPerformance/:schoolId', auth, getStudentPerformance);
router.get('/Admin/reports/classAttendance/:schoolId', auth, getClassAttendanceReport);
router.get('/Admin/reports/teacherActivity/:schoolId', auth, getTeacherActivity);
router.get('/Admin/reports/assignmentCompletion/:schoolId', auth, getAssignmentCompletion);

// ── Admin — Notification management ──────────────────────────────────────────
router.get('/Admin/notifications/preview', auth, previewRecipients);
router.post('/Admin/notifications/send', auth, sendNotification);
router.get('/Admin/notifications/sent/:schoolId', auth, getSentNotifications);
router.delete('/Admin/notifications/:id', auth, deleteNotification);

// ── Assignments ──────────────────────────────────────────────────────────────
router.post('/AssignmentCreate', auth, createAssignment);
router.get('/AssignmentsByClass/:classId', auth, getAssignmentsByClass);
router.get('/AssignmentsBySubject/:subjectId', auth, getAssignmentsBySubject);
router.get('/AssignmentsByTeacher/:teacherId', auth, getAssignmentsByTeacher);
router.delete('/Assignment/:id', auth, deleteAssignment);

// ── Submissions ───────────────────────────────────────────────────────────────
router.post('/SubmitAssignment', auth, requireFeature('fileUploads'), cloudinaryUpload.array('files', 5), submitAssignment);
router.get('/StudentSubmissions/:studentId', auth, getStudentSubmissions);
router.get('/AssignmentSubmissions/:assignmentId', auth, getAssignmentSubmissions);
router.put('/GradeSubmission/:id', auth, gradeSubmission);

// ── Attendance Analytics ──────────────────────────────────────────────────────
router.get('/attendance-analytics/:studentId', auth, getAttendanceAnalytics);

// ── Period-wise Attendance ────────────────────────────────────────────────────
const { markPeriodAttendance, checkPeriodAttendance, getClassAttendancePeriod, getStudentAttendancePeriod } = require('../controllers/period-attendance-controller');
router.post('/api/attendance/mark', auth, markPeriodAttendance);
router.get('/api/attendance/check', auth, checkPeriodAttendance);
router.get('/api/attendance/class/:classId', auth, getClassAttendancePeriod);
router.get('/api/attendance/student/:studentId', auth, getStudentAttendancePeriod);

// ── Report Card ───────────────────────────────────────────────────────────────
const { getReportCard } = require('../controllers/report-card-controller');
router.get('/api/report/student/:studentId', auth, getReportCard);

// ── Generic File Upload (Cloudinary) ─────────────────────────────────────────
const { uploadFiles, deleteFile } = require('../controllers/upload-controller');
router.post('/api/upload/files', auth, cloudinaryUpload.array('files', 10), uploadFiles);
router.delete('/api/upload/delete/:publicId', auth, deleteFile);

// ── Student Documents ─────────────────────────────────────────────────────────
const { getStudentDocuments, uploadStudentDocuments, deleteStudentDocument } = require('../controllers/student-document-controller');
router.get('/api/student-docs/:studentId', auth, getStudentDocuments);
router.post('/api/student-docs/:studentId', auth, cloudinaryUpload.array('documents', 10), uploadStudentDocuments);
router.delete('/api/student-docs/:studentId/:publicId', auth, deleteStudentDocument);

// ── Upcoming Deadlines ────────────────────────────────────────────────────────
router.get('/UpcomingDeadlines/:studentId', auth, getUpcomingDeadlines);

// ── Notifications — SSE stream is public (EventSource can't send headers) ────
router.get('/Notifications/stream/:userId', streamNotifications);
router.get('/Notifications/:userId', auth, getNotifications);
router.put('/Notifications/read/:id', auth, markAsRead);
router.put('/Notifications/readAll/:userId', auth, markAllAsRead);

// ── Serve uploaded files ──────────────────────────────────────────────────────
const express = require('express');
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Tests ───────────────────────────────────────────────────────────────────
router.post('/TestCreate', auth, createTest);
router.get('/TestsByClass/:classId', auth, getTestsByClass);
router.get('/TestsForStudent/:studentId', auth, getTestsForStudent);
router.put('/Test/:id', auth, updateTest);
router.delete('/Test/:id', auth, deleteTest);

// ── Test Attempts ────────────────────────────────────────────────────────────
router.post('/SubmitAttempt', auth, requireFeature('testRetake'), submitAttempt);
router.get('/AttemptsByTest/:testId', auth, getAttemptsByTest);
router.get('/AttemptsByStudent/:studentId', auth, getAttemptsByStudent);
router.get('/Attempt/:id', auth, getAttemptById);

// ── Timetable ─────────────────────────────────────────────────────────────────
router.get('/Timetable/config/:schoolId', auth, getTimetableConfig);
router.post('/Timetable/auto-generate/:schoolId', auth, autoGenerateTimetables);
router.post('/Timetable/:classId/:day', auth, createDayTimetable);
router.get('/Timetable/:classId/:day', auth, getDayTimetable);
router.get('/Timetable/:classId', auth, getWeeklyTimetable);
router.put('/Timetable/:classId/:day/period/:periodNumber', auth, updatePeriod);
router.delete('/Timetable/:classId/:day', auth, deleteDayTimetable);

// ── Teacher Attendance (Timetable) ────────────────────────────────────────────
router.post('/TeacherAttendance', auth, markTeacherAttendance);
router.get('/TeacherAttendance/:teacherId/:date', auth, getTeacherAttendance);
router.get('/TeacherSchedule/:teacherId/:day', auth, getTeacherDaySchedule);

// ── Substitute Assignments ────────────────────────────────────────────────────
router.get('/Substitute/teacher/:teacherId/:date', auth, getSubstitutesByTeacher);
router.get('/Substitute/:classId/:date', auth, getSubstitutesByClassDate);

module.exports = router;