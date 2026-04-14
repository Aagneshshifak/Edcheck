import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Box, Typography, Divider } from '@mui/material';
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
    const navigate  = useNavigate();
    const location  = useLocation();
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
                    background: '#000000',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    color: '#ffffff',
                },
            }}
        >
            <Toolbar sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography sx={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem', letterSpacing: 0.5 }}>
                    Parent Portal
                </Typography>
            </Toolbar>

            <Box sx={{ overflow: 'auto', pt: 1 }}>
                <List disablePadding>
                    {items.map(item => {
                        const active = location.pathname.startsWith(item.path);
                        return (
                            <ListItemButton
                                key={item.text}
                                onClick={() => navigate(item.path)}
                                sx={{
                                    mx: 1, mb: 0.5, borderRadius: '10px',
                                    // Glass effect on active
                                    background: active
                                        ? 'rgba(255,255,255,0.12)'
                                        : 'transparent',
                                    backdropFilter: active ? 'blur(8px)' : 'none',
                                    WebkitBackdropFilter: active ? 'blur(8px)' : 'none',
                                    border: active
                                        ? '1px solid rgba(255,255,255,0.2)'
                                        : '1px solid transparent',
                                    boxShadow: active
                                        ? '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)'
                                        : 'none',
                                    '&:hover': {
                                        background: 'rgba(255,255,255,0.08)',
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                    },
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <ListItemIcon sx={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.5)', minWidth: 36 }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontSize: '0.88rem',
                                        fontWeight: active ? 700 : 400,
                                        color: active ? '#ffffff' : 'rgba(255,255,255,0.65)',
                                    }}
                                />
                            </ListItemButton>
                        );
                    })}

                    <Divider sx={{ my: 1, mx: 2, borderColor: 'rgba(255,255,255,0.08)' }} />

                    <ListItemButton
                        onClick={() => setLogoutOpen(true)}
                        sx={{
                            mx: 1, mb: 0.5, borderRadius: '10px',
                            border: '1px solid transparent',
                            '&:hover': {
                                background: 'rgba(255,255,255,0.08)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.12)',
                            },
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <ListItemIcon sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 36 }}>
                            <ExitToAppIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Logout"
                            primaryTypographyProps={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.65)' }}
                        />
                    </ListItemButton>
                </List>
            </Box>

            <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
        </Drawer>
    );
};

export default ParentSideBar;
