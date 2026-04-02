const router = require('express').Router();
const path = require('path');

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
const { parentRegister, parentLogIn, getParentDetail, getParents, updateParent, deleteParent, addChildToParent } = require('../controllers/parent-controller.js');
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
router.get('/Admin/activity/:schoolId', getActivityLogs);

// ── Admin — Data Management ───────────────────────────────────────────────────
router.get('/Admin/data/export/students/:schoolId', exportStudents);
router.get('/Admin/data/export/teachers/:schoolId', exportTeachers);
router.get('/Admin/data/export/classes/:schoolId', exportClasses);
router.get('/Admin/data/export/testResults/:schoolId', exportTestResults);
router.get('/Admin/data/importHistory/:schoolId', getImportHistory);
router.get('/Admin/data/orphans/:schoolId', getOrphans);
router.delete('/Admin/data/orphans/:schoolId', deleteOrphans);

// ── Admin — Real-time Alerts ──────────────────────────────────────────────────
router.get('/Admin/alerts/:schoolId', getAlerts);

// ── Admin — Bulk Upload ───────────────────────────────────────────────────────
router.post('/Admin/bulk/students', upload.single('file'), bulkUploadStudents);

const { addSubject, removeSubject, getSubjectsDetail, updateTopics, assignTeacher, updateSubject, assignSubjectToClass, unassignSubjectFromClass } = require('../controllers/admin-subject-controller.js');

// ── Admin — Subject Management ────────────────────────────────────────────────
router.post('/Admin/subjects/add', addSubject);
router.delete('/Admin/subjects/:id', removeSubject);
router.put('/Admin/subjects/:id', updateSubject);
router.get('/Admin/subjects/detail/:schoolId', getSubjectsDetail);
router.put('/Admin/subjects/:id/topics', updateTopics);
router.put('/Admin/subjects/:id/teacher', assignTeacher);
router.post('/Admin/subjects/:id/assign-class',    assignSubjectToClass);
router.delete('/Admin/subjects/:id/assign-class',  unassignSubjectFromClass);

// ── Admin — Test Management ───────────────────────────────────────────────────
router.post('/Admin/tests/create', adminCreateTest);
router.put('/Admin/tests/:id/toggle', toggleTestStatus);

// ── Admin — Teacher Management ────────────────────────────────────────────────
router.post('/Admin/teacher/add', addTeacher);
router.put('/Admin/teacher/:id', updateTeacher);
router.delete('/Admin/teacher/:id', removeTeacher);
router.get('/Admin/teacher/:id/performance', getTeacherIndividualPerformance);
router.delete('/Admin/teachers/bulk', bulkDeleteTeachers);
router.put('/Admin/teacher/:id/status', updateTeacherStatus);

// ── Teacher — Class Insights ──────────────────────────────────────────────────
const { getClassInsights } = require('../controllers/teacher-insights-controller');
router.get('/Teacher/class/:classId/insights', getClassInsights);
router.post('/Admin/teacher/:id/resetPassword', resetTeacherPassword);

// ── Class API (public-style CRUD) ─────────────────────────────────────────────
const { createClass, getAllClasses, getClassById, updateClassById, deleteClassById, getClassTree, checkClassIntegrity } = require('../controllers/class-api-controller.js');
router.post('/api/class/create',              createClass);
router.get('/api/class/all',                  getAllClasses);
router.get('/api/class/:id/tree',             getClassTree);
router.get('/api/class/:id/integrity',        checkClassIntegrity);
router.get('/api/class/:id',                  getClassById);
router.put('/api/class/update/:id',           updateClassById);
router.delete('/api/class/delete/:id',        deleteClassById);

// ── Admin — Class Management ──────────────────────────────────────────────────
router.post('/Admin/class/add', addClass);
router.put('/Admin/class/:id', updateClass);
router.delete('/Admin/class/:id', removeClass);
router.get('/Admin/class/:id/detail', getClassDetail);
router.put('/Admin/class/:id/status', toggleClassStatus);
router.post('/Admin/class/:id/analytics/recompute', recomputeClassAnalytics);
router.get('/Admin/class/:id/analytics', getClassAnalytics);

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

// ── Admin — Dashboard summary ─────────────────────────────────────────────────
router.get('/Admin/dashboard/:schoolId', getDashboardSummary);

// ── Admin — Health metrics ────────────────────────────────────────────────────
router.get('/Admin/health/:schoolId', getHealthMetrics);

// ── Admin — School config ─────────────────────────────────────────────────────
router.get('/Admin/config/:schoolId', getConfig);
router.put('/Admin/config/:schoolId', updateConfig);

// ── Admin ────────────────────────────────────────────────────────────────────
router.post('/AdminReg', adminRegister);
router.post('/AdminLogin', adminLogIn);
router.get("/Admin/:id", getAdminDetail);
router.put("/Admin/:id/password", updateAdminPassword);
router.put("/Admin/:id", cloudinaryUpload.single('logo'), updateAdmin);

// ── Student ──────────────────────────────────────────────────────────────────
router.post('/StudentReg', studentRegister);
router.post('/StudentLogin', studentLogIn);
router.get("/Students/:id", getStudents);
router.get("/Student/:id", getStudentDetail);
router.delete("/Students/:id", deleteStudents);
router.delete("/StudentsClass/:id", deleteStudentsByClass);
router.delete("/Student/:id", deleteStudent);
router.put("/Student/:id", updateStudent);
router.put('/UpdateExamResult/:id', updateExamResult);
router.put('/StudentAttendance/:id', studentAttendance);
router.put('/RemoveAllStudentsSubAtten/:id', clearAllStudentsAttendanceBySubject);
router.put('/RemoveAllStudentsAtten/:id', clearAllStudentsAttendance);
router.put('/RemoveStudentSubAtten/:id', removeStudentAttendanceBySubject);
router.put('/RemoveStudentAtten/:id', removeStudentAttendance);
router.get('/StudentProgress/:studentId', getStudentProgress);

// ── Teacher ──────────────────────────────────────────────────────────────────
router.post('/TeacherReg', teacherRegister);
router.post('/TeacherLogin', teacherLogIn);
router.get("/Teachers/:id", getTeachers);
router.get("/Teacher/:id", getTeacherDetail);
router.delete("/Teachers/:id", deleteTeachers);
router.delete("/TeachersClass/:id", deleteTeachersByClass);
router.delete("/Teacher/:id", deleteTeacher);
router.put("/TeacherSubject", updateTeacherSubject);
router.post('/TeacherAttendance/:id', teacherAttendance);

// ── Parent ───────────────────────────────────────────────────────────────────
router.post('/ParentReg', parentRegister);
router.post('/ParentLogin', parentLogIn);
router.get("/Parents/:id", getParents);
router.get("/Parent/:id", getParentDetail);
router.put("/Parent/:id", updateParent);
router.delete("/Parent/:id", deleteParent);
router.put("/ParentAddChild", addChildToParent);

// ── Notice ───────────────────────────────────────────────────────────────────
router.post('/NoticeCreate', noticeCreate);
router.get('/NoticeList/:id', noticeList);
router.delete("/Notices/:id", deleteNotices);
router.delete("/Notice/:id", deleteNotice);
router.put("/Notice/:id", updateNotice);

// ── Complain (legacy) ────────────────────────────────────────────────────────
router.post('/ComplainCreate', complainCreate);
router.get('/ComplainList/:id', complainList);

// ── Class ────────────────────────────────────────────────────────────────────
router.post('/SclassCreate', sclassCreate);
router.get('/SclassList/:id', sclassList);
router.get("/Sclass/Students/:id", getSclassStudents);   // must be before /Sclass/:id
router.get("/Sclass/:id", getSclassDetail);
router.delete("/Sclasses/:id", deleteSclasses);
router.delete("/Sclass/:id", deleteSclass);

// ── Subject ──────────────────────────────────────────────────────────────────
router.post('/SubjectCreate', subjectCreate);
router.get('/AllSubjects/:id', allSubjects);
router.get('/ClassSubjects/:id', classSubjects);
router.get('/FreeSubjectList/:id', freeSubjectList);
router.get("/Subject/:id", getSubjectDetail);
router.delete("/Subject/:id", deleteSubject);
router.delete("/Subjects/:id", deleteSubjects);
router.delete("/SubjectsClass/:id", deleteSubjectsByClass);

// ── Admin — Assignment oversight ──────────────────────────────────────────────
router.get('/Admin/assignments/:schoolId', getSchoolAssignments);

// ── Admin — Test oversight ────────────────────────────────────────────────────
router.get('/Admin/tests/:schoolId', getSchoolTests);

// ── Admin — Attendance reporting ──────────────────────────────────────────────
router.get('/Admin/attendance/school/:schoolId', getSchoolAttendance);
router.get('/Admin/attendance/class/:classId', getClassAttendance);
router.get('/Admin/attendance/student/:studentId', getStudentAttendance);

// ── Admin — Analytics ─────────────────────────────────────────────────────────
router.get('/Admin/analytics/overview/:schoolId', getAnalyticsOverview);
router.get('/Admin/analytics/leaderboard/:schoolId', requireFeature('leaderboard'), getLeaderboard);
router.get('/Admin/analytics/subjectDifficulty/:schoolId', getSubjectDifficulty);
router.get('/Admin/analytics/teachers/:schoolId', getTeacherPerformance);
router.get('/Admin/analytics/risk/:schoolId', getStudentRisk);
router.get('/Admin/analytics/gradeDistribution/:schoolId', getGradeDistribution);
router.get('/Admin/analytics/cohortProgression/:schoolId', getCohortProgression);
router.get('/Admin/analytics/riskTrends/:schoolId', getRiskTrends);
router.get('/Admin/analytics/parentEngagement/:schoolId', getParentEngagement);
router.get('/Admin/school/:schoolId/analytics', getSchoolAnalytics);

// ── Admin — Reports ───────────────────────────────────────────────────────────
router.get('/Admin/reports/studentPerformance/:schoolId', getStudentPerformance);
router.get('/Admin/reports/classAttendance/:schoolId', getClassAttendanceReport);
router.get('/Admin/reports/teacherActivity/:schoolId', getTeacherActivity);
router.get('/Admin/reports/assignmentCompletion/:schoolId', getAssignmentCompletion);

// ── Admin — Notification management ──────────────────────────────────────────
router.get('/Admin/notifications/preview', previewRecipients);
router.post('/Admin/notifications/send', sendNotification);
router.get('/Admin/notifications/sent/:schoolId', getSentNotifications);
router.delete('/Admin/notifications/:id', deleteNotification);

// ── Assignments ──────────────────────────────────────────────────────────────
router.post('/AssignmentCreate', createAssignment);
router.get('/AssignmentsByClass/:classId', getAssignmentsByClass);
router.get('/AssignmentsBySubject/:subjectId', getAssignmentsBySubject);
router.get('/AssignmentsByTeacher/:teacherId', getAssignmentsByTeacher);
router.delete('/Assignment/:id', deleteAssignment);

// ── Submissions ───────────────────────────────────────────────────────────────
router.post('/SubmitAssignment', requireFeature('fileUploads'), cloudinaryUpload.single('file'), submitAssignment);
router.get('/StudentSubmissions/:studentId', getStudentSubmissions);
router.get('/AssignmentSubmissions/:assignmentId', getAssignmentSubmissions);
router.put('/GradeSubmission/:id', gradeSubmission);

// ── Attendance Analytics ──────────────────────────────────────────────────────
router.get('/attendance-analytics/:studentId', getAttendanceAnalytics);

// ── Upcoming Deadlines ────────────────────────────────────────────────────────
router.get('/UpcomingDeadlines/:studentId', getUpcomingDeadlines);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/Notifications/stream/:userId', streamNotifications);
router.get('/Notifications/:userId', getNotifications);
router.put('/Notifications/read/:id', markAsRead);
router.put('/Notifications/readAll/:userId', markAllAsRead);

// ── Serve uploaded files ──────────────────────────────────────────────────────
const express = require('express');
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Tests ───────────────────────────────────────────────────────────────────
router.post('/TestCreate', createTest);
router.get('/TestsByClass/:classId', getTestsByClass);
router.get('/TestsForStudent/:studentId', getTestsForStudent);
router.put('/Test/:id', updateTest);
router.delete('/Test/:id', deleteTest);

// ── Test Attempts ────────────────────────────────────────────────────────────
router.post('/SubmitAttempt', requireFeature('testRetake'), submitAttempt);
router.get('/AttemptsByTest/:testId', getAttemptsByTest);
router.get('/AttemptsByStudent/:studentId', getAttemptsByStudent);
router.get('/Attempt/:id', getAttemptById);

module.exports = router;