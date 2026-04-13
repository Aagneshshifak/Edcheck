import * as React from 'react';
import { Divider, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Box } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import LogoutDialog from '../../pages/Logout';
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
import FolderIcon from '@mui/icons-material/Folder';
import CampaignIcon from '@mui/icons-material/Campaign';

const NavItem = ({ to, icon, label, active }) => (
    <ListItemButton component={Link} to={to}
        sx={{
            borderRadius: '8px', mx: 1, mb: 0.5,
            background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
            borderLeft: active ? '3px solid #ffffff' : '3px solid transparent',
            '&:hover': { background: 'rgba(255,255,255,0.08)' },
            transition: 'all 0.2s ease',
        }}>
        <ListItemIcon sx={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.5)', minWidth: 36 }}>
            {icon}
        </ListItemIcon>
        <ListItemText primary={label}
            primaryTypographyProps={{ sx: { color: active ? '#ffffff' : 'rgba(255,255,255,0.6)', fontSize: '0.88rem', fontWeight: active ? 600 : 400 } }} />
    </ListItemButton>
);

const StudentSideBar = () => {
    const loc = useLocation();
    const is = (path) => loc.pathname === path || loc.pathname.startsWith(path + '/');
    const [logoutOpen, setLogoutOpen] = React.useState(false);

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
            <NavItem to="/Student/performance" icon={<TrendingUpIcon />} label="Performance" active={is('/Student/performance')} />
            <NavItem to="/Student/documents" icon={<FolderIcon />} label="My Documents" active={is('/Student/documents')} />
            <NavItem to="/Student/notices" icon={<CampaignIcon />} label="Notices" active={is('/Student/notices')} />
            <NavItem to="/Student/complain" icon={<AnnouncementOutlinedIcon />} label="Complain" active={is('/Student/complain')} />

            <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.08)' }} />

            <ListSubheader sx={{ bgcolor: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', letterSpacing: 1.5, lineHeight: 2 }}>
                ACCOUNT
            </ListSubheader>
            <NavItem to="/Student/profile" icon={<AccountCircleOutlinedIcon />} label="Profile" active={is('/Student/profile')} />

            {/* Logout — dialog */}
            <ListItemButton
                onClick={() => setLogoutOpen(true)}
                sx={{
                    borderRadius: '8px', mx: 1, mb: 0.5,
                    background: 'transparent',
                    borderLeft: '3px solid transparent',
                    '&:hover': { background: 'rgba(255,255,255,0.08)' },
                    transition: 'all 0.2s ease',
                }}
            >
                <ListItemIcon sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 36 }}>
                    <ExitToAppIcon />
                </ListItemIcon>
                <ListItemText primary="Logout"
                    primaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', fontWeight: 400 } }} />
            </ListItemButton>

            <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
        </Box>
    );
};

export default StudentSideBar;
