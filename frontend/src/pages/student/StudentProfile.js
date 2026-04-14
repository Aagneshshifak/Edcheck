import React from 'react';
import {
    Card, CardContent, Typography, Grid, Box, Avatar,
    Container, Paper, Divider,
} from '@mui/material';
import { useSelector } from 'react-redux';
import PersonIcon from '@mui/icons-material/Person';

const InfoRow = ({ label, value }) => (
    <Box sx={{ py: 1.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160, fontWeight: 600 }}>
            {label}
        </Typography>
        <Typography variant="body2">{value || '—'}</Typography>
    </Box>
);

const StudentProfile = () => {
    const { currentUser } = useSelector((state) => state.user);
    const sclassName   = currentUser.sclassName;
    const studentSchool = currentUser.school;

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            {/* Avatar card */}
            <Paper variant="outlined" sx={{ p: 4, mb: 3, textAlign: 'center' }}>
                <Avatar sx={{ width: 96, height: 96, fontSize: '2rem', mx: 'auto', mb: 2, bgcolor: '#111111' }}>
                    {String(currentUser.name).charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="h5" fontWeight={700}>{currentUser.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Roll No: {currentUser.rollNum}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Class</Typography>
                        <Typography variant="body2" fontWeight={600}>{sclassName?.sclassName || '—'}</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">School</Typography>
                        <Typography variant="body2" fontWeight={600}>{studentSchool?.schoolName || '—'}</Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Personal info */}
            <Card variant="outlined">
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <PersonIcon fontSize="small" />
                        <Typography variant="h6" fontWeight={700}>Personal Information</Typography>
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <Grid container>
                        <Grid item xs={12} sm={6}>
                            <InfoRow label="Date of Birth" value="January 1, 2000" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <InfoRow label="Gender" value="Male" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <InfoRow label="Email" value="student@example.com" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <InfoRow label="Phone" value="(123) 456-7890" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <InfoRow label="Address" value="123 Main Street, City" />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <InfoRow label="Emergency Contact" value="(987) 654-3210" />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Container>
    );
};

export default StudentProfile;
