import { useState } from 'react';
import {
    CssBaseline,
    Box,
    Toolbar,
    List,
    Typography,
    Divider,
    IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import TeacherSideBar from './TeacherSideBar';
import { Navigate, Route, Routes } from 'react-router-dom';
import Logout from '../Logout'
import AccountMenu from '../../components/AccountMenu';
import NotificationBell from '../../components/NotificationBell';
import { AppBar, Drawer } from '../../components/styles';
import StudentAttendance from '../admin/studentRelated/StudentAttendance';

import TeacherClassDetails from './TeacherClassDetails';
import TeacherComplain from './TeacherComplain';
import TeacherHomePage from './TeacherHomePage';
import TeacherProfile from './TeacherProfile';
import TeacherViewStudent from './TeacherViewStudent';
import StudentExamMarks from '../admin/studentRelated/StudentExamMarks';
import CreateTest from './CreateTest';
import TestList from './TestList';
import TestResults from './TestResults';
import AddQuestions from './AddQuestions';
import LearningProgressChart from '../student/LearningProgressChart';
import TakeAttendance from './TakeAttendance';
import WeakStudentsPanel from './WeakStudentsPanel';
import TeacherAssignments from './TeacherAssignments';
import TeacherAnalytics from './TeacherAnalytics';
import TeacherTimetable from './TeacherTimetable';
import MarksEntry from './MarksEntry';
import GenerateReport from './GenerateReport';
import TeacherNotices from './TeacherNotices';

const TeacherDashboard = () => {
    const [open, setOpen] = useState(true);
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
                            sx={{
                                marginRight: '36px',
                                ...(open && { display: 'none' }),
                            }}
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
                            Teacher Dashboard
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
                        <TeacherSideBar />
                    </List>
                </Drawer>
                <Box component="main" sx={styles.boxStyled}>
                    <Toolbar />
                    <Routes>
                        <Route path="/" element={<TeacherHomePage />} />
                        <Route path='*' element={<Navigate to="/" />} />
                        <Route path="/Teacher/dashboard" element={<TeacherHomePage />} />
                        <Route path="/Teacher/profile" element={<TeacherProfile />} />

                        <Route path="/Teacher/complain" element={<TeacherComplain />} />

                        <Route path="/Teacher/class" element={<TeacherClassDetails />} />
                        <Route path="/Teacher/class/student/:id" element={<TeacherViewStudent />} />

                        <Route path="/Teacher/class/student/attendance/:studentID/:subjectID" element={<StudentAttendance situation="Subject" />} />
                        <Route path="/Teacher/class/student/marks/:studentID/:subjectID" element={<StudentExamMarks situation="Subject" />} />

                        <Route path="/Teacher/tests" element={<TestList />} />
                        <Route path="/Teacher/tests/create" element={<CreateTest />} />
                        <Route path="/Teacher/tests/:testId/questions" element={<AddQuestions />} />
                        <Route path="/Teacher/tests/:testId/results" element={<TestResults />} />

                        <Route path="/Teacher/class/student/:id/progress" element={<LearningProgressChart viewerRole="Teacher" />} />
                        <Route path="/Teacher/assignments" element={<TeacherAssignments />} />
                        <Route path="/Teacher/attendance" element={<TakeAttendance />} />
                        <Route path="/Teacher/weak-students" element={<WeakStudentsPanel />} />
                        <Route path="/Teacher/analytics" element={<TeacherAnalytics />} />
                        <Route path="/Teacher/timetable" element={<TeacherTimetable />} />
                        <Route path="/Teacher/marks" element={<MarksEntry />} />
                        <Route path="/Teacher/enter-marks" element={<MarksEntry />} />
                        <Route path="/Teacher/reports" element={<GenerateReport />} />
                        <Route path="/Teacher/notices" element={<TeacherNotices />} />

                        <Route path="/logout" element={<Logout />} />
                    </Routes>
                </Box>
            </Box>
        </>
    );
}

export default TeacherDashboard

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
        background: '#000000',
    },
    drawerStyled: {
        display: "flex"
    },
    hideDrawer: {
        display: 'flex',
        '@media (max-width: 600px)': {
            display: 'none',
        },
    },
}