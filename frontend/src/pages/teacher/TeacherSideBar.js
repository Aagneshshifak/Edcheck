import { useState } from 'react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Collapse, Divider, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
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

// Styling constants — identical to SideBar.js (admin) for visual consistency
const ACCENT       = '#0ea5e9';
const ACCENT_DIM   = 'rgba(14,165,233,0.1)';
const TEXT_ACTIVE  = '#e2e8f0';
const TEXT_MUTED   = 'rgba(148,163,184,0.9)';
const SECTION_COLOR = 'rgba(148,163,184,0.7)';

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
                <ListItemIcon sx={{ minWidth: 34, color: isOpen ? ACCENT : 'rgba(148,163,184,0.8)' }}>
                    {icon}
                </ListItemIcon>
                <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                        fontSize: '0.85rem',
                        fontWeight: isOpen ? 600 : 400,
                        color: isOpen ? '#e2e8f0' : 'rgba(148,163,184,0.9)',
                    }}
                />
                {open
                    ? <ExpandLessIcon sx={{ fontSize: 16, color: 'rgba(148,163,184,0.6)' }} />
                    : <ExpandMoreIcon sx={{ fontSize: 16, color: 'rgba(148,163,184,0.6)' }} />
                }
            </ListItemButton>
            <Collapse in={open} timeout="auto" unmountOnExit>
                <List disablePadding>{children}</List>
            </Collapse>
        </>
    );
};

const TeacherSideBar = () => (
    <Box sx={{ py: 1, overflowY: 'auto', height: '100%' }}>
        <List disablePadding>
            <NavItem icon={<DashboardIcon fontSize="small" />} label="Dashboard" path="/" />

            <Divider sx={{ my: 1, borderColor: 'rgba(14,165,233,0.1)' }} />

            <Section label="Class Management" />
            <CollapseGroup icon={<SchoolIcon fontSize="small" />} label="Class Management" prefix="/Teacher/class">
                <NavItem icon={<ClassOutlinedIcon fontSize="small" />} label="My Classes" path="/Teacher/class" indent />
                <NavItem icon={<GroupsIcon fontSize="small" />} label="Students" path="/Teacher/class" indent />
            </CollapseGroup>

            <Divider sx={{ my: 1, borderColor: 'rgba(14,165,233,0.1)' }} />

            <Section label="Academics" />
            <NavItem icon={<EventNoteIcon fontSize="small" />} label="Attendance" path="/Teacher/attendance" />
            <NavItem icon={<AssignmentOutlinedIcon fontSize="small" />} label="Assignments" path="/Teacher/assignments" />
            <NavItem icon={<QuizIcon fontSize="small" />} label="Tests" path="/Teacher/tests" />
            <NavItem icon={<CalendarMonthIcon fontSize="small" />} label="Timetable" path="/Teacher/timetable" />

            <Divider sx={{ my: 1, borderColor: 'rgba(14,165,233,0.1)' }} />

            <Section label="Communication" />
            <NavItem icon={<AnnouncementOutlinedIcon fontSize="small" />} label="Notices" path="/Teacher/complain" />
            <NavItem icon={<MessageIcon fontSize="small" />} label="Messages" path="/Teacher/complain" />

            <Divider sx={{ my: 1, borderColor: 'rgba(14,165,233,0.1)' }} />

            <Section label="Analytics" />
            <NavItem icon={<BarChartIcon fontSize="small" />} label="Performance" path="/Teacher/analytics" />
            <NavItem icon={<WarningAmberIcon fontSize="small" />} label="Weak Students" path="/Teacher/weak-students" />

            <Divider sx={{ my: 1, borderColor: 'rgba(14,165,233,0.1)' }} />

            <NavItem icon={<AccountCircleOutlinedIcon fontSize="small" />} label="Profile" path="/Teacher/profile" />
            <NavItem icon={<ExitToAppIcon fontSize="small" />} label="Logout" path="/logout" />
        </List>
    </Box>
);

export default TeacherSideBar;
