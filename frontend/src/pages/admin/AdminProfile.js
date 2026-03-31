import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
    Box, Button, TextField, Typography, Avatar, Alert,
    CircularProgress, Paper, Stack
} from '@mui/material';
import { authSuccess } from '../../redux/userRelated/userSlice';

const AdminProfile = () => {
    const dispatch = useDispatch();
    const { currentUser } = useSelector((state) => state.user);

    const [name, setName] = useState(currentUser?.name || '');
    const [email, setEmail] = useState(currentUser?.email || '');
    const [schoolName, setSchoolName] = useState(currentUser?.schoolName || '');
    const [schoolAddress, setSchoolAddress] = useState(currentUser?.schoolAddress || '');
    const [phone, setPhone] = useState(currentUser?.phone || '');
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(currentUser?.logoUrl || '');
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileMsg, setProfileMsg] = useState(null);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [pwMsg, setPwMsg] = useState(null);

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileMsg(null);
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('email', email);
            formData.append('schoolName', schoolName);
            formData.append('schoolAddress', schoolAddress);
            formData.append('phone', phone);
            if (logoFile) formData.append('logo', logoFile);

            const { data } = await axios.put(
                `${process.env.REACT_APP_BASE_URL}/Admin/${currentUser._id}`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );

            if (data.message) {
                setProfileMsg({ type: 'error', text: data.message });
            } else {
                dispatch(authSuccess({ ...data, role: currentUser.role }));
                if (data.logoUrl) setLogoPreview(data.logoUrl);
                setLogoFile(null);
                setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            setProfileMsg({ type: 'error', text: msg });
        } finally {
            setProfileLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPwMsg(null);
        if (newPassword !== confirmPassword) {
            setPwMsg({ type: 'error', text: 'New passwords do not match.' });
            return;
        }
        if (newPassword.length < 6) {
            setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
            return;
        }
        setPwLoading(true);
        try {
            const { data } = await axios.put(
                `${process.env.REACT_APP_BASE_URL}/Admin/${currentUser._id}/password`,
                { currentPassword, newPassword },
                { headers: { 'Content-Type': 'application/json' } }
            );
            if (data.message && data.message !== 'Password updated successfully') {
                setPwMsg({ type: 'error', text: data.message });
            } else {
                setPwMsg({ type: 'success', text: 'Password changed successfully.' });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            setPwMsg({ type: 'error', text: msg });
        } finally {
            setPwLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 680, mx: 'auto', p: 3 }}>
            <Typography variant="h5" fontWeight={600} mb={3}>
                Admin Profile &amp; School Settings
            </Typography>

            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" mb={2}>Profile Information</Typography>
                <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                    <Avatar src={logoPreview} alt="School Logo" sx={{ width: 72, height: 72 }} />
                    <Box>
                        <Button variant="outlined" component="label" size="small">
                            Upload School Logo
                            <input type="file" hidden accept="image/png,image/jpeg,image/jpg" onChange={handleLogoChange} />
                        </Button>
                        <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>
                            PNG or JPG, max 20 MB
                        </Typography>
                    </Box>
                </Stack>

                <Box component="form" onSubmit={handleProfileSubmit}>
                    <Stack spacing={2}>
                        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
                        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
                        <TextField label="School Name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required fullWidth />
                        <TextField label="School Address" value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} fullWidth />
                        <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
                    </Stack>
                    {profileMsg && <Alert severity={profileMsg.type} sx={{ mt: 2 }}>{profileMsg.text}</Alert>}
                    <Button
                        type="submit"
                        variant="contained"
                        sx={{ mt: 2 }}
                        disabled={profileLoading}
                        startIcon={profileLoading ? <CircularProgress size={16} /> : null}
                    >
                        {profileLoading ? 'Saving...' : 'Save Profile'}
                    </Button>
                </Box>
            </Paper>

            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" mb={2}>Change Password</Typography>
                <Box component="form" onSubmit={handlePasswordSubmit}>
                    <Stack spacing={2}>
                        <TextField
                            label="Current Password"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            fullWidth
                            autoComplete="current-password"
                        />
                        <TextField
                            label="New Password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            fullWidth
                            autoComplete="new-password"
                        />
                        <TextField
                            label="Confirm New Password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            fullWidth
                            autoComplete="new-password"
                        />
                    </Stack>
                    {pwMsg && <Alert severity={pwMsg.type} sx={{ mt: 2 }}>{pwMsg.text}</Alert>}
                    <Button
                        type="submit"
                        variant="contained"
                        color="secondary"
                        sx={{ mt: 2 }}
                        disabled={pwLoading}
                        startIcon={pwLoading ? <CircularProgress size={16} /> : null}
                    >
                        {pwLoading ? 'Updating...' : 'Change Password'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default AdminProfile;
