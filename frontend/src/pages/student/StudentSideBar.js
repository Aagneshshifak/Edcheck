import * as React from 'react';
import { Divider, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Box } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import ClassOutlinedIcon from '@mui/icons-material/ClassOutlined';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BarChartIcon from '@mui/icons-material/BarChart';
import QuizIcon from '@mui/icons-material/Quiz';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { theme } from '../../theme/studentTheme';

const NavItem = ({ to, icon, label, active }) => (
    <ListItemButton component={Link} to={to}
        sx={{
            borderRadius: '10px', mx: 1, mb: 0.5,
            background: active
                ? 'linear-gradient(90deg, rgba(14,165,233,0.18), rgba(14,165,233,0.08))'
                : 'transparent',
            borderLeft: active ? `3px solid #0ea5e9` : '3px solid transparent',
            '&:hover': { background: 'rgba(14,165,233,0.1)' },
            transition: 'all 0.25s ease',
        }}>
        <ListItemIcon sx={{ color: active ? '#0ea5e9' : 'rgba(229,231,235,0.45)', minWidth: 36 }}>
            {icon}
        </ListItemIcon>
        <ListItemText primary={label}
            primaryTypographyProps={{ sx: { color: active ? '#e5e7eb' : 'rgba(229,231,235,0.5)', fontSize: '0.88rem', fontWeight: active ? 600 : 400 } }} />
    </ListItemButton>
);

const StudentSideBar = () => {
    const loc = useLocation();
    const is = (path) => loc.pathname === path || loc.pathname.startsWith(path + '/');

    return (
        <Box sx={{ pt: 1 }}>
            <NavItem to="/" icon={<HomeIcon />} label="Home" active={loc.pathname === '/' || loc.pathname === '/Student/dashboard'} />
            <NavItem to="/Student/subjects" icon={<MenuBookIcon />} label="Subjects" active={is('/Student/subjects')} />
            <NavItem to="/Student/assignments" icon={<AssignmentIcon />} label="Assignments" active={is('/Student/assignments')} />
            <NavItem to="/Student/attendance" icon={<BarChartIcon />} label="Attendance" active={is('/Student/attendance')} />
            <NavItem to="/Student/tests" icon={<QuizIcon />} label="Tests" active={is('/Student/tests')} />
            <NavItem to="/Student/progress" icon={<TrendingUpIcon />} label="Progress" active={is('/Student/progress')} />
            <NavItem to="/Student/timetable" icon={<CalendarMonthIcon />} label="Timetable" active={is('/Student/timetable')} />
            <NavItem to="/Student/report" icon={<AssessmentIcon />} label="Report Card" active={is('/Student/report')} />
            <NavItem to="/Student/complain" icon={<AnnouncementOutlinedIcon />} label="Complain" active={is('/Student/complain')} />

            <Divider sx={{ my: 1, borderColor: 'rgba(30,144,255,0.15)' }} />

            <ListSubheader sx={{ bgcolor: 'transparent', color: theme.textMuted, fontSize: '0.7rem', letterSpacing: 1.5, lineHeight: 2 }}>
                ACCOUNT
            </ListSubheader>
            <NavItem to="/Student/profile" icon={<AccountCircleOutlinedIcon />} label="Profile" active={is('/Student/profile')} />
            <NavItem to="/logout" icon={<ExitToAppIcon />} label="Logout" active={is('/logout')} />
        </Box>
    );
};

export default StudentSideBar;
