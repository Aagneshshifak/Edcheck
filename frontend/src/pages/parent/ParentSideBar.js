import { Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar, Box, Typography } from '@mui/material';
import { FamilyRestroom, EventNote, Campaign } from '@mui/icons-material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import LogoutDialog from '../../pages/Logout';

const drawerWidth = 220;

const items = [
    { text: 'My Children', icon: <FamilyRestroom />, path: '/Parent/mychildren' },
    { text: 'Attendance',  icon: <EventNote />,      path: '/Parent/attendance' },
    { text: 'Notices',     icon: <Campaign />,       path: '/Parent/notices' },
];

const ParentSideBar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [logoutOpen, setLogoutOpen] = useState(false);

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: drawerWidth,
                    boxSizing: 'border-box',
                    bgcolor: '#111111',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    color: 'white',
                },
            }}
        >
            <Toolbar>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1.1rem', letterSpacing: 1 }}>
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
                                    bgcolor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                                    borderLeft: active ? '3px solid #ffffff' : '3px solid transparent',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                                }}
                            >
                                <ListItemIcon sx={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.45)', minWidth: 36 }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontSize: '0.9rem',
                                        fontWeight: active ? 700 : 400,
                                        color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                                    }}
                                />
                            </ListItem>
                        );
                    })}
                    <ListItem
                        button
                        onClick={() => setLogoutOpen(true)}
                        sx={{ mx: 1, borderRadius: 2, mt: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
                    >
                        <ListItemIcon sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 36 }}><ExitToAppIcon /></ListItemIcon>
                        <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }} />
                    </ListItem>
                </List>
            </Box>
            <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
        </Drawer>
    );
};

export default ParentSideBar;
