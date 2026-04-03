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
import Logout from '../Logout';
import AccountMenu from '../../components/AccountMenu';
import NotificationBell from '../../components/NotificationBell';
import { AppBar, Drawer } from '../../components/styles';
import { theme } from '../../theme/studentTheme';

const StudentDashboard = () => {
    const [open, setOpen] = useState(true);

    return (
        <Box sx={{ display: 'flex', background: theme.bg, minHeight: '100vh' }}>
            <CssBaseline />
            <AppBar open={open} position='absolute' sx={{
                background: theme.appBar,
                borderBottom: `1px solid ${theme.divider}`,
                boxShadow: '0 2px 20px rgba(0,0,0,0.5)',
            }}>
                <Toolbar sx={{ pr: '24px' }}>
                    <IconButton edge="start" color="inherit" onClick={() => setOpen(!open)}
                        sx={{ marginRight: '36px', ...(open && { display: 'none' }) }}>
                        <MenuIcon />
                    </IconButton>
                    <Typography component="h1" variant="h6" noWrap sx={{ flexGrow: 1, color: theme.text, fontWeight: 700, letterSpacing: 0.5 }}>
                        Student Dashboard
                    </Typography>
                    <NotificationBell />
                    <AccountMenu />
                </Toolbar>
            </AppBar>

            <Drawer variant="permanent" open={open} sx={open ? {
                display: 'flex',
                '& .MuiDrawer-paper': {
                    background: theme.drawer,
                    borderRight: `1px solid ${theme.divider}`,
                }
            } : {
                display: 'flex',
                '@media (max-width: 600px)': { display: 'none' },
                '& .MuiDrawer-paper': {
                    background: theme.drawer,
                    borderRight: `1px solid ${theme.divider}`,
                }
            }}>
                <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: [1] }}>
                    <IconButton onClick={() => setOpen(!open)} sx={{ color: theme.accent }}>
                        <ChevronLeftIcon />
                    </IconButton>
                </Toolbar>
                <Divider sx={{ borderColor: 'rgba(30,144,255,0.15)' }} />
                <List component="nav">
                    <StudentSideBar />
                </List>
            </Drawer>

            <Box component="main" sx={{ flexGrow: 1, height: '100vh', overflow: 'auto', background: theme.bg }}>
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
                    <Route path="/logout" element={<Logout />} />
                    <Route path='*' element={<Navigate to="/" />} />
                </Routes>
            </Box>
        </Box>
    );
};

export default StudentDashboard;
