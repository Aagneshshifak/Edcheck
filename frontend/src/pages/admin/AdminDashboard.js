import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    CssBaseline,
    Box,
    Toolbar,
    List,
    Typography,
    Divider,
    IconButton,
} from '@mui/material';
import { DevLogProvider, useDevLog } from '../../context/DevLogContext';
import DevLogPanel from '../../components/DevLogPanel';
import { attachAxiosLogger } from '../../utils/axiosLogger';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppBar, Drawer } from '../../components/styles';
import Logout from '../Logout';
import SideBar from './SideBar';
import AdminProfile from './AdminProfile';
import AdminHomePage from './AdminHomePage';

import AddStudent from './studentRelated/AddStudent';
import SeeComplains from './studentRelated/SeeComplains';
import ShowStudents from './studentRelated/ShowStudents';
import StudentAttendance from './studentRelated/StudentAttendance';
import StudentExamMarks from './studentRelated/StudentExamMarks';
import ViewStudent from './studentRelated/ViewStudent';

import AddNotice from './noticeRelated/AddNotice';
import ShowNotices from './noticeRelated/ShowNotices';

import ShowSubjects from './subjectRelated/ShowSubjects';
import SubjectForm from './subjectRelated/SubjectForm';
import ViewSubject from './subjectRelated/ViewSubject';

import AddTeacher from './teacherRelated/AddTeacher';
import ChooseClass from './teacherRelated/ChooseClass';
import ChooseSubject from './teacherRelated/ChooseSubject';
import ShowTeachers from './teacherRelated/ShowTeachers';
import TeacherDetails from './teacherRelated/TeacherDetails';

import AddClass from './classRelated/AddClass';
import ClassDetails from './classRelated/ClassDetails';
import ShowClasses from './classRelated/ShowClasses';
import AccountMenu from '../../components/AccountMenu';
import NotificationBell from '../../components/NotificationBell';

import SystemHealth from './systemRelated/SystemHealth';
import SystemConfig from './configRelated/SystemConfig';
import DataManager from './dataRelated/DataManager';
import AnalyticsDashboard from './analyticsRelated/AnalyticsDashboard';

import AssignmentOversight from './assignmentRelated/AssignmentOversight';
import AssignmentDetail from './assignmentRelated/AssignmentDetail';
import TestOversight from './testRelated/TestOversight';
import TestDetail from './testRelated/TestDetail';
import AttendanceReport from './attendanceRelated/AttendanceReport';
import NotificationCenter from './notificationRelated/NotificationCenter';
import ReportCenter from './reportRelated/ReportCenter';
import Leaderboard from './analyticsRelated/Leaderboard';
import AlertsCenter from './alertsRelated/AlertsCenter';
import ActivityLog from './activityRelated/ActivityLog';
import BulkUpload from './studentRelated/BulkUpload';
import TeacherManagement from './teacherRelated/TeacherManagement';
import ClassManagement from './classRelated/ClassManagement';
import ClassDetail from './classRelated/ClassDetail';
import StudentManagement from './studentRelated/StudentManagement';
import SubjectManagement from './subjectRelated/SubjectManagement';
import TimetableBuilder from './timetableRelated/TimetableBuilder';
import TeacherAttendanceManager from './timetableRelated/TeacherAttendanceManager';
import AILogViewer from './systemRelated/AILogViewer';

const AdminDashboardInner = () => {
    const [open, setOpen] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { addLog } = useDevLog();
    const schoolId = useSelector(s => s.user.currentUser?._id);

    useEffect(() => {
        const cleanup = attachAxiosLogger(addLog);
        return cleanup;
    }, [addLog]);

    // Validate session — if admin _id no longer exists in DB, clear stale session
    useEffect(() => {
        if (!schoolId) return;
        axiosInstance.get(`${process.env.REACT_APP_BASE_URL}/Admin/${schoolId}`)
            .catch(err => {
                if (err.response?.status === 404) {
                    localStorage.removeItem('user');
                    window.location.reload();
                }
            });
    }, [schoolId]); // eslint-disable-line

    const toggleDrawer = () => {
        setOpen(!open);
    };

    return (
        <>
            <Box sx={{ display: 'flex' }}>
                <CssBaseline />
                <AppBar open={open} position='absolute'>
                    <Toolbar sx={{ pr: '24px' }}>
                        <IconButton
                            edge="start"
                            color="inherit"
                            aria-label="open drawer"
                            onClick={toggleDrawer}
                            sx={{ marginRight: '24px' }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <IconButton
                            edge="start"
                            color="inherit"
                            aria-label="open mobile drawer"
                            onClick={() => setDrawerOpen(true)}
                            sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Typography
                            component="h1"
                            variant="h6"
                            color="inherit"
                            noWrap
                            sx={{ flexGrow: 1 }}
                        >
                            Admin Dashboard
                        </Typography>
                        <NotificationBell />
                        <AccountMenu />
                    </Toolbar>
                </AppBar>
                <Drawer variant="permanent" open={open} sx={open ? styles.drawerStyled : styles.hideDrawer}>
                    <Toolbar sx={styles.toolBarStyled}>
                        <IconButton onClick={toggleDrawer}>
                            <ChevronLeftIcon />
                        </IconButton>
                    </Toolbar>
                    <Divider />
                    <List component="nav">
                        <SideBar />
                    </List>
                </Drawer>
                <Drawer
                    variant="temporary"
                    anchor="left"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    sx={{ display: { xs: 'block', md: 'none' } }}
                >
                    <List component="nav">
                        <SideBar />
                    </List>
                </Drawer>
                <Box component="main" sx={styles.boxStyled}>
                    <Toolbar />
                    <Routes>
                        <Route path="/" element={<AdminHomePage />} />
                        <Route path='*' element={<Navigate to="/" />} />
                        <Route path="/Admin/dashboard" element={<AdminHomePage />} />
                        <Route path="/Admin/profile" element={<AdminProfile />} />
                        <Route path="/Admin/complains" element={<SeeComplains />} />

                        {/* Notice */}
                        <Route path="/Admin/addnotice" element={<AddNotice />} />
                        <Route path="/Admin/notices" element={<ShowNotices />} />

                        {/* Subject */}
                        <Route path="/Admin/subjects" element={<ShowSubjects />} />
                        <Route path="/Admin/subjects/subject/:classID/:subjectID" element={<ViewSubject />} />
                        <Route path="/Admin/subjects/chooseclass" element={<ChooseClass situation="Subject" />} />

                        <Route path="/Admin/addsubject/:id" element={<SubjectForm />} />
                        <Route path="/Admin/class/subject/:classID/:subjectID" element={<ViewSubject />} />

                        <Route path="/Admin/subject/student/attendance/:studentID/:subjectID" element={<StudentAttendance situation="Subject" />} />
                        <Route path="/Admin/subject/student/marks/:studentID/:subjectID" element={<StudentExamMarks situation="Subject" />} />

                        {/* Class */}
                        <Route path="/Admin/addclass" element={<AddClass />} />
                        <Route path="/Admin/classes" element={<ShowClasses />} />
                        <Route path="/Admin/classes/class/:id" element={<ClassDetails />} />
                        <Route path="/Admin/class/addstudents/:id" element={<AddStudent situation="Class" />} />

                        {/* Student */}
                        <Route path="/Admin/addstudents" element={<AddStudent situation="Student" />} />
                        <Route path="/Admin/students" element={<ShowStudents />} />
                        <Route path="/Admin/students/student/:id" element={<ViewStudent />} />
                        <Route path="/Admin/students/student/attendance/:id" element={<StudentAttendance situation="Student" />} />
                        <Route path="/Admin/students/student/marks/:id" element={<StudentExamMarks situation="Student" />} />

                        {/* Teacher */}
                        <Route path="/Admin/teachers" element={<ShowTeachers />} />
                        <Route path="/Admin/teachers/teacher/:id" element={<TeacherDetails />} />
                        <Route path="/Admin/teachers/chooseclass" element={<ChooseClass situation="Teacher" />} />
                        <Route path="/Admin/teachers/choosesubject/:id" element={<ChooseSubject situation="Norm" />} />
                        <Route path="/Admin/teachers/choosesubject/:classID/:teacherID" element={<ChooseSubject situation="Teacher" />} />
                        <Route path="/Admin/teachers/addteacher/:id" element={<AddTeacher />} />

                        <Route path="/logout" element={<Logout />} />

                        {/* New module pages */}
                        <Route path="/Admin/assignments" element={<AssignmentOversight />} />
                        <Route path="/Admin/assignments/:id" element={<AssignmentDetail />} />
                        <Route path="/Admin/tests" element={<TestOversight />} />
                        <Route path="/Admin/tests/:id" element={<TestDetail />} />
                        <Route path="/Admin/attendance" element={<AttendanceReport />} />
                        <Route path="/Admin/notifications" element={<NotificationCenter />} />
                        <Route path="/Admin/reports" element={<ReportCenter />} />
                        <Route path="/Admin/leaderboard" element={<Leaderboard />} />
                        <Route path="/Admin/alerts" element={<AlertsCenter />} />
                        <Route path="/Admin/activity" element={<ActivityLog />} />
                        <Route path="/Admin/bulk-upload" element={<BulkUpload />} />

                        {/* Enhanced management pages */}
                        <Route path="/Admin/manage/teachers" element={<TeacherManagement />} />
                        <Route path="/Admin/manage/classes" element={<ClassManagement />} />
                        <Route path="/Admin/manage/classes/:id" element={<ClassDetail />} />
                        <Route path="/Admin/manage/students" element={<StudentManagement />} />
                        <Route path="/Admin/manage/subjects" element={<SubjectManagement />} />

                        {/* System & data pages */}
                        <Route path="/Admin/health" element={<SystemHealth />} />
                        <Route path="/Admin/config" element={<SystemConfig />} />
                        <Route path="/Admin/data" element={<DataManager />} />
                        <Route path="/Admin/analytics" element={<AnalyticsDashboard />} />
                        <Route path="/Admin/timetable" element={<TimetableBuilder />} />
                        <Route path="/Admin/teacher-attendance" element={<TeacherAttendanceManager />} />
                        <Route path="/Admin/ai-logs" element={<AILogViewer />} />
                    </Routes>
                </Box>
            </Box>
            <DevLogPanel />
        </>
    );
}

const AdminDashboard = () => (
    <DevLogProvider>
        <AdminDashboardInner />
    </DevLogProvider>
);

export default AdminDashboard

const styles = {
    boxStyled: {
        background: '#111111',
        flexGrow: 1,
        minHeight: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
    },
    toolBarStyled: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        px: [1],
        background: '#111111',
    },
    drawerStyled: {
        display: 'flex',
    },
    hideDrawer: {
        display: 'flex',
        '@media (max-width: 600px)': {
            display: 'none',
        },
    },
}