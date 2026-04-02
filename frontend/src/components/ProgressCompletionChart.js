import React, { useEffect, useState } from 'react';
import { Typography, CircularProgress, Box } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const BASE = process.env.REACT_APP_BASE_URL;

const ProgressCompletionChart = ({ classId, teacherId }) => {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!teacherId) return;
        setLoading(true);
        axios.get(`${BASE}/AssignmentsByTeacher/${teacherId}`)
            .then(({ data }) => {
                const filtered = (Array.isArray(data) ? data : []).filter(a => {
                    const id = a.sclassName?._id || a.sclassName;
                    return String(id) === String(classId);
                });

                const built = filtered.map(a => ({
                    name: (a.title || '').slice(0, 20),
                    submitted: a.submissionCount ?? 0,
                    pending: Math.max(0, (a.totalStudents ?? 0) - (a.submissionCount ?? 0)),
                }));

                setChartData(built);
            })
            .catch(() => setChartData([]))
            .finally(() => setLoading(false));
    }, [classId, teacherId]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <CircularProgress size={24} sx={{ color: '#0ea5e9' }} />
            </Box>
        );
    }

    if (chartData.length === 0) {
        return <Typography sx={{ color: '#94a3b8', mt: 1 }}>No assignment data available.</Typography>;
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="submitted" fill="#0ea5e9" name="Submitted" />
                <Bar dataKey="pending" fill="#f97316" name="Pending" />
            </BarChart>
        </ResponsiveContainer>
    );
};

export default ProgressCompletionChart;
