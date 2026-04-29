import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Typography } from '@mui/material';
import { filterBySubjects, generateSubjectColors } from './progressUtils';

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
        <div style={{
            backgroundColor: '#1e1e2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            color: '#e2e8f0',
            fontSize: '0.8rem',
        }}>
            {payload.map((entry) => {
                const item = entry.payload[entry.dataKey + '_raw'];
                if (!item) return null;
                return (
                    <div key={entry.dataKey} style={{ marginBottom: 4 }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: entry.color }}>{item.subjectName}</p>
                        <p style={{ margin: '2px 0 0', color: '#94a3b8' }}>Date: {new Date(item.date).toLocaleDateString()}</p>
                        <p style={{ margin: '2px 0 0', color: '#94a3b8' }}>Marks: {item.marks} / {item.maxMarks}</p>
                        <p style={{ margin: '2px 0 0', color: '#e2e8f0' }}>Score: <strong style={{ color: entry.color }}>{item.percentageScore}%</strong></p>
                    </div>
                );
            })}
        </div>
    );
};

const ProgressLineChart = ({ data, selectedSubjects }) => {
    const filtered = filterBySubjects(data, selectedSubjects);

    if (filtered.length === 0) {
        return <Typography>No progress data available yet</Typography>;
    }

    // Get distinct subjects from filtered data
    const subjects = [...new Set(filtered.map((item) => item.subjectName))];
    const subjectColors = generateSubjectColors(subjects);

    // Group by date: { date: { subjectName: percentageScore, subjectName_raw: ProgressItem } }
    const dateMap = {};
    for (const item of filtered) {
        const dateKey = new Date(item.date).toLocaleDateString();
        if (!dateMap[dateKey]) {
            dateMap[dateKey] = { date: dateKey };
        }
        dateMap[dateKey][item.subjectName] = item.percentageScore;
        dateMap[dateKey][item.subjectName + '_raw'] = item;
    }

    const chartData = Object.values(dateMap).sort((a, b) =>
        new Date(a.date) - new Date(b.date)
    );

    return (
        <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                {subjects.map((subject) => (
                    <Line
                        key={subject}
                        type="monotone"
                        dataKey={subject}
                        stroke={subjectColors[subject]}
                        dot={true}
                        connectNulls
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
};

export default ProgressLineChart;
