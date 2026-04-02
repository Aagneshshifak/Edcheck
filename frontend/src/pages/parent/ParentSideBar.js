import { Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar, Box, Typography } from '@mui/material';
import { FamilyRestroom, EventNote, Logout } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authLogout } from '../../redux/userRelated/userSlice';

const drawerWidth = 220;

const items = [
    { text: 'My Children', icon: <FamilyRestroom />, path: '/Parent/mychildren' },
    { text: 'Attendance',  icon: <EventNote />,      path: '/Parent/attendance' },
];

const ParentSideBar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: drawerWidth,
                    boxSizing: 'border-box',
                    bgcolor: '#0f172a',
                    borderRight: '1px solid rgba(14,165,233,0.15)',
                    color: 'white',
                },
            }}
        >
            <Toolbar>
                <Typography sx={{ color: '#0ea5e9', fontWeight: 800, fontSize: '1.1rem', letterSpacing: 1 }}>
                    Parent Portal
                </Typography>
            </Toolbar>
            <Box sx={{ overflow: 'auto' }}>
                <List>
                    {items.map(item => {
                        const active = location.pathname.startsWith(item.path);
                        return (
                            <ListItem
                                button
                                key={item.text}
                                onClick={() => navigate(item.path)}
                                sx={{
                                    mx: 1, borderRadius: 2, mb: 0.5,
                                    bgcolor: active ? 'rgba(14,165,233,0.15)' : 'transparent',
                                    '&:hover': { bgcolor: 'rgba(14,165,233,0.1)' },
                                }}
                            >
                                <ListItemIcon sx={{ color: active ? '#0ea5e9' : 'rgba(229,231,235,0.5)', minWidth: 36 }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontSize: '0.9rem',
                                        fontWeight: active ? 700 : 400,
                                        color: active ? '#e5e7eb' : 'rgba(229,231,235,0.6)',
                                    }}
                                />
                            </ListItem>
                        );
                    })}
                    <ListItem
                        button
                        onClick={() => { dispatch(authLogout()); navigate('/'); }}
                        sx={{ mx: 1, borderRadius: 2, mt: 2, '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
                    >
                        <ListItemIcon sx={{ color: 'rgba(239,68,68,0.7)', minWidth: 36 }}><Logout /></ListItemIcon>
                        <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: '0.9rem', color: 'rgba(239,68,68,0.7)' }} />
                    </ListItem>
                </List>
            </Box>
        </Drawer>
    );
};

export default ParentSideBar;
