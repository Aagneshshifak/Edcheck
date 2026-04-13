import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { authLogout } from '../redux/userRelated/userSlice';
import LogoutIcon from '@mui/icons-material/Logout';

/**
 * LogoutDialog — reusable confirmation dialog.
 * Usage: <LogoutDialog open={open} onClose={() => setOpen(false)} />
 */
const LogoutDialog = ({ open, onClose }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const handleConfirm = () => {
        dispatch(authLogout());
        navigate('/');
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
        >
            <DialogTitle sx={{ fontWeight: 700, pb: 1, background: '#ffffff !important', color: '#111111 !important' }}>
                Sign out
            </DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
                <Typography sx={{ fontSize: '0.95rem' }}>
                    Are you sure you want to log out?
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    startIcon={<LogoutIcon />}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                    }}
                >
                    Log out
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LogoutDialog;
