import React, { useState } from 'react';
import { Box, Avatar, Menu, MenuItem, ListItemIcon, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import { Settings, Logout } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LogoutDialog from '../pages/Logout';

const AccountMenu = () => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [logoutOpen, setLogoutOpen] = useState(false);
    const open = Boolean(anchorEl);
    const { currentRole, currentUser } = useSelector(state => state.user);

    const handleClick = (e) => setAnchorEl(e.currentTarget);
    const handleClose = () => setAnchorEl(null);

    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title="Account settings">
                    <IconButton onClick={handleClick} size="small" sx={{ ml: 2 }}
                        aria-controls={open ? 'account-menu' : undefined}
                        aria-haspopup="true" aria-expanded={open ? 'true' : undefined}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#ffffff', color: '#000000', fontWeight: 700, fontSize: '0.9rem' }}>
                            {String(currentUser.name).charAt(0).toUpperCase()}
                        </Avatar>
                    </IconButton>
                </Tooltip>
            </Box>

            <Menu anchorEl={anchorEl} id="account-menu" open={open} onClose={handleClose} onClick={handleClose}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        background: '#111111',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 2,
                        mt: 1.5,
                        minWidth: 180,
                        '& .MuiAvatar-root': { width: 32, height: 32, ml: -0.5, mr: 1 },
                        '&:before': {
                            content: '""', display: 'block', position: 'absolute',
                            top: 0, right: 14, width: 10, height: 10,
                            bgcolor: '#111111', transform: 'translateY(-50%) rotate(45deg)', zIndex: 0,
                        },
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem component={Link} to={`/${currentRole}/profile`}
                    sx={{ color: '#ffffff', gap: 1, '&:hover': { background: 'rgba(255,255,255,0.08)' } }}>
                    <Avatar sx={{ bgcolor: '#333333', color: '#ffffff', fontSize: '0.85rem', width: 32, height: 32 }}>
                        {String(currentUser.name).charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography sx={{ fontSize: '0.9rem', color: '#ffffff' }}>Profile</Typography>
                </MenuItem>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

                <MenuItem onClick={handleClose}
                    sx={{ color: '#ffffff', '&:hover': { background: 'rgba(255,255,255,0.06)' } }}>
                    <ListItemIcon sx={{ color: '#ffffff' }}>
                        <Settings fontSize="small" />
                    </ListItemIcon>
                    <Typography sx={{ fontSize: '0.9rem', color: '#ffffff' }}>Settings</Typography>
                </MenuItem>

                <MenuItem
                    onClick={() => { handleClose(); setLogoutOpen(true); }}
                    sx={{ color: '#ffffff', '&:hover': { background: 'rgba(255,255,255,0.08)' } }}
                >
                    <ListItemIcon sx={{ color: '#ffffff' }}>
                        <Logout fontSize="small" />
                    </ListItemIcon>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>Log out</Typography>
                </MenuItem>
            </Menu>

            <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
        </>
    );
};

export default AccountMenu;
