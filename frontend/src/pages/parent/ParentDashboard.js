import { useState } from 'react';
import { Box, Toolbar, Typography, AppBar } from '@mui/material';
import ParentSideBar from './ParentSideBar';
import MyChildrenPage from './MyChildrenPage';
import ParentAttendancePage from './ParentAttendancePage';
import ChildDashboard from './ChildDashboard';
import ParentNoticesPage from './ParentNoticesPage';
import { Route, Routes, Navigate } from 'react-router-dom';

const ParentDashboard = () => {
    const [open, setOpen] = useState(false);

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#ffffff' }}>
            <AppBar position="fixed" sx={{ bgcolor: '#111111', borderBottom: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)', zIndex: 1201 }}>
                <Toolbar>
                    <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1.1rem', flexGrow: 1 }}>
                        Edcheck
                    </Typography>
                </Toolbar>
            </AppBar>

            <ParentSideBar open={open} setOpen={setOpen} />

            <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, background: '#ffffff', minHeight: '100vh' }}>
                <Routes>
                    {/* Default: always land on My Children */}
                    <Route path="/" element={<Navigate to="/Parent/mychildren" replace />} />
                    <Route path="/Parent/mychildren" element={<MyChildrenPage />} />
                    <Route path="/Parent/student/:studentId" element={<ChildDashboard />} />
                    <Route path="/Parent/attendance" element={<ParentAttendancePage />} />
                    <Route path="/Parent/notices" element={<ParentNoticesPage />} />
                    {/* Legacy redirect */}
                    <Route path="/Parent/dashboard" element={<Navigate to="/Parent/mychildren" replace />} />
                    <Route path="*" element={<Navigate to="/Parent/mychildren" replace />} />
                </Routes>
            </Box>
        </Box>
    );
};

export default ParentDashboard;
