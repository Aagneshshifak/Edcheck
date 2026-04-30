import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Box, List, ListItemButton, ListItemIcon, ListItemText,
    Collapse, Typography, Divider,
} from '@mui/material';
import LogoutDialog from '../../pages/Logout';

import DashboardIcon        from '@mui/icons-material/Dashboard';
import ManageAccountsIcon   from '@mui/icons-material/ManageAccounts';
import GroupsIcon            from '@mui/icons-material/Groups';
import SchoolIcon            from '@mui/icons-material/School';
import TopicIcon             from '@mui/icons-material/Topic';
import AssignmentIcon        from '@mui/icons-material/Assignment';
import QuizIcon              from '@mui/icons-material/Quiz';
import EventNoteIcon         from '@mui/icons-material/EventNote';
import AnnouncementIcon      from '@mui/icons-material/Announcement';
import NotificationsIcon     from '@mui/icons-material/Notifications';
import FeedbackIcon          from '@mui/icons-material/Feedback';
import BarChartIcon          from '@mui/icons-material/BarChart';
import SummarizeIcon         from '@mui/icons-material/Summarize';
import PsychologyIcon        from '@mui/icons-material/Psychology';
import WarningAmberIcon      from '@mui/icons-material/WarningAmber';
import SettingsIcon          from '@mui/icons-material/Settings';
import AccountCircleIcon     from '@mui/icons-material/AccountCircle';
import ExitToAppIcon         from '@mui/icons-material/ExitToApp';
import ExpandLessIcon        from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon        from '@mui/icons-material/ExpandMore';
import StorageIcon           from '@mui/icons-material/Storage';

const ACCENT = '#ffffff';
const ACCENT_DIM = 'rgba(255,255,255,0.1)';

const Section = ({ label }) => (
    <Typography
        sx={{
            px: 2, pt: 2, pb: 0.5,
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
            userSelect: 'none',
        }}
    >
        {label}
    </Typography>
);

const NavItem = ({ icon, label, path, indent = false }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const active = path === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(path);

    return (
        <ListItemButton
            onClick={() => navigate(path)}
            sx={{
                mx: 1, my: 0.25,
                borderRadius: '8px',
                pl: indent ? 4 : 2,
                py: 0.75,
                transition: 'all 0.18s ease',
                borderLeft: active ? `3px solid ${ACCENT}` : '3px solid transparent',
                bgcolor: active ? ACCENT_DIM : 'transparent',
                '&:hover': {
                    bgcolor: ACCENT_DIM,
                    pl: indent ? 4.5 : 2.5,
                },
            }}
        >
            <ListItemIcon sx={{ minWidth: 34, color: active ? ACCENT : 'rgba(255,255,255,0.5)' }}>
                {icon}
            </ListItemIcon>
            <ListItemText
                primary={label}
                primaryTypographyProps={{
                    fontSize: '0.85rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                }}
            />
        </ListItemButton>
    );
};

const CollapseGroup = ({ icon, label, prefix, children }) => {
    const location = useLocation();
    const isOpen = location.pathname.startsWith(prefix);
    const [open, setOpen] = useState(isOpen);

    return (
        <>
            <ListItemButton
                onClick={() => setOpen(o => !o)}
                sx={{
                    mx: 1, my: 0.25,
                    borderRadius: '8px',
                    py: 0.75,
                    transition: 'all 0.18s ease',
                    '&:hover': { bgcolor: ACCENT_DIM },
                }}
            >
                <ListItemIcon sx={{ minWidth: 34, color: isOpen ? ACCENT : 'rgba(255,255,255,0.5)' }}>
                    {icon}
                </ListItemIcon>
                <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                        fontSize: '0.85rem',
                        fontWeight: isOpen ? 600 : 400,
                        color: isOpen ? '#ffffff' : 'rgba(255,255,255,0.65)',
                    }}
                />
                {open
                    ? <ExpandLessIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
                    : <ExpandMoreIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
                }
            </ListItemButton>
            <Collapse in={open} timeout="auto" unmountOnExit>
                <List disablePadding>{children}</List>
            </Collapse>
        </>
    );
};

const SideBar = () => {
    const [logoutOpen, setLogoutOpen] = useState(false);
    return (
    <Box sx={{ py: 1, overflowY: 'auto', height: '100%' }}>
        <List disablePadding>

            {/* Dashboard */}
            <NavItem icon={<DashboardIcon fontSize="small" />} label="Dashboard" path="/" />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            {/* Management */}
            <Section label="Management" />
            <NavItem icon={<ManageAccountsIcon fontSize="small" />} label="Teachers"  path="/Admin/manage/teachers" />
            <NavItem icon={<GroupsIcon          fontSize="small" />} label="Students"  path="/Admin/manage/students" />
            <NavItem icon={<SchoolIcon          fontSize="small" />} label="Classes"   path="/Admin/manage/classes"  />
            <NavItem icon={<TopicIcon           fontSize="small" />} label="Subjects"  path="/Admin/manage/subjects" />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            {/* Academics */}
            <Section label="Academics" />
            <NavItem icon={<AssignmentIcon fontSize="small" />} label="Assignments" path="/Admin/assignments" />
            <NavItem icon={<QuizIcon       fontSize="small" />} label="Tests"       path="/Admin/tests"       />
            <NavItem icon={<EventNoteIcon  fontSize="small" />} label="Attendance"  path="/Admin/attendance"  />
            <NavItem icon={<EventNoteIcon  fontSize="small" />} label="Timetable"   path="/Admin/timetable"   />
            <NavItem icon={<EventNoteIcon  fontSize="small" />} label="Teacher Attendance" path="/Admin/teacher-attendance" />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            {/* Communication */}
            <Section label="Communication" />
            <NavItem icon={<AnnouncementIcon  fontSize="small" />} label="Notices"       path="/Admin/notices"       />
            <NavItem icon={<NotificationsIcon fontSize="small" />} label="Notifications" path="/Admin/notifications" />
            <NavItem icon={<FeedbackIcon      fontSize="small" />} label="Feedback"      path="/Admin/complains"     />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            {/* Analytics */}
            <Section label="Analytics" />
            <NavItem icon={<SummarizeIcon    fontSize="small" />} label="Reports"   path="/Admin/reports"   />
            <NavItem icon={<BarChartIcon     fontSize="small" />} label="Analytics" path="/Admin/analytics" />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            {/* System */}
            <Section label="System" />
            <NavItem icon={<AccountCircleIcon fontSize="small" />} label="Profile"  path="/Admin/profile" />
            <NavItem icon={<StorageIcon       fontSize="small" />} label="AI Logs"  path="/Admin/ai-logs" />

            {/* Logout — triggers dialog */}
            <ListItemButton
                onClick={() => setLogoutOpen(true)}
                sx={{
                    mx: 1, my: 0.25, borderRadius: '8px', pl: 2, py: 0.75,
                    borderLeft: '3px solid transparent',
                    transition: 'all 0.18s ease',
                    '&:hover': { bgcolor: ACCENT_DIM, pl: 2.5 },
                }}
            >
                <ListItemIcon sx={{ minWidth: 34, color: 'rgba(255,255,255,0.5)' }}>
                    <ExitToAppIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Logout"
                    primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 400, color: 'rgba(255,255,255,0.65)' }} />
            </ListItemButton>

        </List>
        <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </Box>
    );
};

export default SideBar;
