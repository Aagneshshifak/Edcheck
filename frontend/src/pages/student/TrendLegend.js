import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { computeTrend, filterBySubjects } from './progressUtils';

const TREND_CONFIG = {
    up: { symbol: '↑', color: 'green' },
    down: { symbol: '↓', color: 'red' },
    neutral: { symbol: '—', color: 'grey' },
};

const TrendLegend = ({ data = [], selectedSubjects = [], subjectColors = {} }) => {
    const filtered = filterBySubjects(data, selectedSubjects);

    // Group entries by subjectName, preserving order of first appearance
    const subjectMap = {};
    for (const item of filtered) {
        if (!subjectMap[item.subjectName]) {
            subjectMap[item.subjectName] = [];
        }
        subjectMap[item.subjectName].push(item);
    }

    const subjects = Object.keys(subjectMap);

    if (subjects.length === 0) return null;

    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
            {subjects.map((subjectName) => {
                const entries = subjectMap[subjectName];
                const trend = computeTrend(entries);
                const trendConfig = trend ? TREND_CONFIG[trend] : null;
                const dotColor = subjectColors[subjectName] || '#888';

                return (
                    <Box
                        key={subjectName}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                    >
                        {/* Coloured dot */}
                        <Box
                            sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: dotColor,
                                flexShrink: 0,
                            }}
                        />

                        {/* Subject name */}
                        <Typography variant="body2">{subjectName}</Typography>

                        {/* Trend arrow */}
                        {trendConfig && (
                            <Typography
                                variant="body2"
                                sx={{ color: trendConfig.color, fontWeight: 'bold' }}
                            >
                                {trendConfig.symbol}
                            </Typography>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};

export default TrendLegend;
