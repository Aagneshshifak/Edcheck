import { useState } from 'react';
import { CssBaseline, Box, Toolbar, List, Typography, Divider, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import StudentSideBar from './StudentSideBar';
import { Navigate, Route, Routes } from 'react-router-dom';
import StudentHomePage from './StudentHomePage';
import StudentProfile from './StudentProfile';
import StudentSubjects from './StudentSubjects';
import StudentAttendancePage from './StudentAttendancePage';
import StudentAssignments from './StudentAssignments';
import StudentComplain from './StudentComplain';
import StudentTestList from './StudentTestList';
import TestRunner from './TestRunner';
import StudentTestResult from './StudentTestResult';
import LearningProgressChart from './LearningProgressChart';
import StudentTimetable from './StudentTimetable';
import StudentReportCard from './StudentReportCard';
import AcademicPerformanceDashboard from './AcademicPerformanceDashboard';
import StudentDocuments from './StudentDocuments';
import StudentNotices from './StudentNotices';
import Logout from '../Logout';
import AccountMenu from '../../components/AccountMenu';
import NotificationBell from '../../components/NotificationBell';
import { AppBar, Drawer } from '../../components/styles';

const StudentDashboard = () => {
    const [open, setOpen] = useState(true);

    return (
        <Box sx={{ display: 'flex', background: '#111111' }}>
            <CssBaseline />
            <AppBar open={open} position='absolute'>
                <Toolbar sx={{ pr: '24px' }}>
                    <IconButton edge="start" color="inherit" onClick={() => setOpen(!open)}
                        sx={{ marginRight: '36px', ...(open && { display: 'none' }) }}>
                        <MenuIcon />
                    </IconButton>
                    <Typography component="h1" variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 700 }}>
                        Student Dashboard
                    </Typography>
                    <NotificationBell />
                    <AccountMenu />
                </Toolbar>
            </AppBar>

            <Drawer variant="permanent" open={open}>
                <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: [1], background: '#000000' }}>
                    <IconButton onClick={() => setOpen(!open)} sx={{ color: '#ffffff' }}>
                        <ChevronLeftIcon />
                    </IconButton>
                </Toolbar>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                <List component="nav">
                    <StudentSideBar />
                </List>
            </Drawer>

            <Box component="main" sx={{ flexGrow: 1, minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden', background: '#111111' }}>
                <Toolbar />
                <Routes>
                    <Route path="/" element={<StudentHomePage />} />
                    <Route path="/Student/dashboard" element={<StudentHomePage />} />
                    <Route path="/Student/profile" element={<StudentProfile />} />
                    <Route path="/Student/subjects" element={<StudentSubjects />} />
                    <Route path="/Student/attendance" element={<StudentAttendancePage />} />
                    <Route path="/Student/assignments" element={<StudentAssignments />} />
                    <Route path="/Student/complain" element={<StudentComplain />} />
                    <Route path="/Student/tests" element={<StudentTestList />} />
                    <Route path="/Student/test/:testId" element={<TestRunner />} />
                    <Route path="/Student/test/:testId/result" element={<StudentTestResult />} />
                    <Route path="/Student/progress" element={<LearningProgressChart viewerRole="Student" />} />
                    <Route path="/Student/timetable" element={<StudentTimetable />} />
                    <Route path="/Student/report" element={<StudentReportCard />} />
                    <Route path="/Student/performance" element={<AcademicPerformanceDashboard />} />
                    <Route path="/Student/documents" element={<StudentDocuments />} />
                    <Route path="/Student/notices" element={<StudentNotices />} />
                    <Route path="/logout" element={<Logout />} />
                    <Route path='*' element={<Navigate to="/" />} />
                </Routes>
            </Box>
        </Box>
    );
};

export default StudentDashboard;
