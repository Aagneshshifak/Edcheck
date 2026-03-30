import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import ParentSideBar from './ParentSideBar';
import ParentHomePage from './ParentHomePage';
import ParentAttendancePage from './ParentAttendancePage';
import { Route, Routes, Navigate } from 'react-router-dom';

const ParentDashboard = () => {
    const [open, setOpen] = useState(false);
    const { currentUser } = useSelector(state => state.user);

    return (
        <Box sx={{ display: 'flex' }}>
            <ParentSideBar open={open} setOpen={setOpen} />
            <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
                <Routes>
                    <Route path="/" element={<Navigate to="dashboard" />} />
                    <Route path="dashboard" element={<ParentHomePage />} />
                    <Route path="attendance" element={<ParentAttendancePage />} />
                </Routes>
            </Box>
        </Box>
    );
};

export default ParentDashboard;
