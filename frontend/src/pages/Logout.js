import React from 'react';
import { Dialog, Box, Typography, Button } from '@mui/material';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { authLogout } from '../redux/userRelated/userSlice';
import LogoutIcon from '@mui/icons-material/Logout';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

const LogoutDialog = ({ open, onClose }) => {
    const dispatch  = useDispatch();
    const navigate  = useNavigate();

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
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    overflow: 'hidden',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                },
            }}
        >
            {/* Single unified box — no title/content/actions split */}
            <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {/* Icon */}
                <Box sx={{
                    width: 56, height: 56, borderRadius: '50%',
                    bgcolor: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <ExitToAppIcon sx={{ color: '#ffffff', fontSize: '1.6rem' }} />
                </Box>

                {/* Text */}
                <Box sx={{ textAlign: 'center' }}>
                    <Typography fontWeight={700} fontSize="1.15rem" color="#ffffff" mb={0.5}>
                        Sign out
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        Are you sure you want to log out?
                    </Typography>
                </Box>

                {/* Buttons */}
                <Box sx={{ display: 'flex', gap: 1.5, width: '100%', mt: 1 }}>
                    <Button
                        fullWidth
                        onClick={onClose}
                        variant="outlined"
                        sx={{
                            borderRadius: 3,
                            textTransform: 'none',
                            fontWeight: 600,
                            borderColor: 'rgba(255,255,255,0.2)',
                            color: 'rgba(255,255,255,0.7)',
                            '&:hover': {
                                borderColor: 'rgba(255,255,255,0.4)',
                                bgcolor: 'rgba(255,255,255,0.05)',
                            },
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        fullWidth
                        onClick={handleConfirm}
                        variant="contained"
                        startIcon={<LogoutIcon />}
                        sx={{
                            borderRadius: 3,
                            textTransform: 'none',
                            fontWeight: 700,
                            bgcolor: '#ffffff',
                            color: '#111111',
                            '&:hover': { bgcolor: '#e0e0e0' },
                        }}
                    >
                        Log out
                    </Button>
                </Box>
            </Box>
        </Dialog>
    );
};

export default LogoutDialog;
