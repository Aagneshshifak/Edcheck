import { useState } from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Collapse, Divider, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import LogoutDialog from '../../pages/Logout';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SchoolIcon from '@mui/icons-material/School';
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined';
import GroupsIcon from '@mui/icons-material/Groups';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import QuizIcon from '@mui/icons-material/Quiz';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import MessageIcon from '@mui/icons-material/Message';
import BarChartIcon from '@mui/icons-material/BarChart';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GradeIcon from '@mui/icons-material/Grade';
import AssessmentIcon from '@mui/icons-material/Assessment';

const ACCENT       = '#ffffff';
const ACCENT_DIM   = 'rgba(255,255,255,0.1)';
const TEXT_ACTIVE  = '#ffffff';
const TEXT_MUTED   = 'rgba(255,255,255,0.65)';
const SECTION_COLOR = 'rgba(255,255,255,0.4)';

// Non-interactive section label
const Section = ({ label }) => (
    <Typography
        sx={{
            px: 2, pt: 2, pb: 0.5,
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: SECTION_COLOR,
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
                borderRadius: '10px',
                pl: indent ? 4 : 2,
                py: 0.75,
                transition: 'all 0.18s ease',
                // Glass effect on active
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                backdropFilter: active ? 'blur(8px)' : 'none',
                WebkitBackdropFilter: active ? 'blur(8px)' : 'none',
                border: active ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                boxShadow: active ? '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
                '&:hover': {
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                },
            }}
        >
            <ListItemIcon sx={{ minWidth: 34, color: active ? ACCENT : 'rgba(148,163,184,0.8)' }}>
                {icon}
            </ListItemIcon>
            <ListItemText
                primary={label}
                primaryTypographyProps={{
                    fontSize: '0.85rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#e2e8f0' : TEXT_MUTED,
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

const TeacherSideBar = () => {
    const [logoutOpen, setLogoutOpen] = useState(false);
    return (
    <Box sx={{ py: 1, overflowY: 'auto', height: '100%' }}>
        <List disablePadding>
            <NavItem icon={<DashboardIcon fontSize="small" />} label="Dashboard" path="/" />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            <Section label="Class Management" />
            <CollapseGroup icon={<SchoolIcon fontSize="small" />} label="Class Management" prefix="/Teacher/class">
                <NavItem icon={<ClassOutlinedIcon fontSize="small" />} label="My Classes" path="/Teacher/class" indent />
                <NavItem icon={<GroupsIcon fontSize="small" />} label="Students" path="/Teacher/class" indent />
            </CollapseGroup>

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            <Section label="Academics" />
            <NavItem icon={<EventNoteIcon fontSize="small" />} label="Attendance" path="/Teacher/attendance" />
            <NavItem icon={<AssignmentOutlinedIcon fontSize="small" />} label="Assignments" path="/Teacher/assignments" />
            <NavItem icon={<QuizIcon fontSize="small" />} label="Tests" path="/Teacher/tests" />
            <NavItem icon={<CalendarMonthIcon fontSize="small" />} label="Timetable" path="/Teacher/timetable" />
            <NavItem icon={<GradeIcon fontSize="small" />} label="Enter Marks" path="/Teacher/marks" />
            <NavItem icon={<AssessmentIcon fontSize="small" />} label="Generate Report" path="/Teacher/reports" />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            <Section label="Communication" />
            <NavItem icon={<AnnouncementOutlinedIcon fontSize="small" />} label="Notices" path="/Teacher/notices" />
            <NavItem icon={<MessageIcon fontSize="small" />} label="Messages" path="/Teacher/complain" />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            <Section label="Analytics" />
            <NavItem icon={<BarChartIcon fontSize="small" />} label="Performance" path="/Teacher/analytics" />
            <NavItem icon={<WarningAmberIcon fontSize="small" />} label="Weak Students" path="/Teacher/weak-students" />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            <NavItem icon={<AccountCircleOutlinedIcon fontSize="small" />} label="Profile" path="/Teacher/profile" />

            {/* Logout — dialog */}
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
                    primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: 400, color: TEXT_MUTED }} />
            </ListItemButton>
        </List>
        <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </Box>
    );
};

export default TeacherSideBar;
