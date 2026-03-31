import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    ResponsiveContainer,
} from 'recharts';
import { Typography } from '@mui/material';
import { filterBySubjects, computeSubjectAverages, generateSubjectColors } from './progressUtils';

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const { subjectName, averagePercentageScore } = payload[0].payload;

    return (
        <div style={{
            backgroundColor: '#fff',
            borderRadius: 4,
            padding: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#000' }}>{subjectName}</p>
            <p style={{ margin: 0, color: '#1e1e1e' }}>Avg Score: {averagePercentageScore}%</p>
        </div>
    );
};

const ProgressBarChart = ({ data, selectedSubjects }) => {
    const filtered = filterBySubjects(data, selectedSubjects);

    if (filtered.length === 0) {
        return <Typography>No subject data available yet</Typography>;
    }

    const subjects = [...new Set(filtered.map((item) => item.subjectName))];
    const subjectColors = generateSubjectColors(subjects);
    const averages = computeSubjectAverages(filtered);

    const chartData = subjects.map((subjectName) => ({
        subjectName,
        averagePercentageScore: averages[subjectName],
    }));

    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="subjectName" />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="averagePercentageScore">
                    {chartData.map((entry) => (
                        <Cell key={entry.subjectName} fill={subjectColors[entry.subjectName]} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

export default ProgressBarChart;
