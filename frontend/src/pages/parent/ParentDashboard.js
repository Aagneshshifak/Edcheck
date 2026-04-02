import { useState } from 'react';
import { Box, Toolbar, Typography, AppBar } from '@mui/material';
import ParentSideBar from './ParentSideBar';
import MyChildrenPage from './MyChildrenPage';
import ParentAttendancePage from './ParentAttendancePage';
import ChildDashboard from './ChildDashboard';
import { Route, Routes, Navigate } from 'react-router-dom';

const ParentDashboard = () => {
    const [open, setOpen] = useState(false);

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0f172a' }}>
            <AppBar position="fixed" sx={{ bgcolor: '#0f172a', borderBottom: '1px solid rgba(14,165,233,0.15)', boxShadow: 'none', zIndex: 1201 }}>
                <Toolbar>
                    <Typography sx={{ color: '#e5e7eb', fontWeight: 700, fontSize: '1.1rem', flexGrow: 1 }}>
                        School Management
                    </Typography>
                </Toolbar>
            </AppBar>

            <ParentSideBar open={open} setOpen={setOpen} />

            <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
                <Routes>
                    {/* Default: always land on My Children */}
                    <Route path="/" element={<Navigate to="/Parent/mychildren" replace />} />
                    <Route path="/Parent/mychildren" element={<MyChildrenPage />} />
                    <Route path="/Parent/student/:studentId" element={<ChildDashboard />} />
                    <Route path="/Parent/attendance" element={<ParentAttendancePage />} />
                    {/* Legacy redirect */}
                    <Route path="/Parent/dashboard" element={<Navigate to="/Parent/mychildren" replace />} />
                    <Route path="*" element={<Navigate to="/Parent/mychildren" replace />} />
                </Routes>
            </Box>
        </Box>
    );
};

export default ParentDashboard;
