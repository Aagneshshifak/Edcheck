import React from 'react';
import { Box, Chip, useTheme } from '@mui/material';

const SubjectFilter = ({ subjects = [], selected = [], onChange }) => {
    const theme = useTheme();

    const handleToggle = (subject) => {
        const isSelected = selected.includes(subject);
        const updated = isSelected
            ? selected.filter((s) => s !== subject)
            : [...selected, subject];
        onChange(updated);
    };

    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {subjects.map((subject) => {
                const isSelected = selected.includes(subject);
                return (
                    <Chip
                        key={subject}
                        label={subject}
                        variant={isSelected ? 'filled' : 'outlined'}
                        color={isSelected ? 'primary' : 'default'}
                        onClick={() => handleToggle(subject)}
                        sx={{
                            cursor: 'pointer',
                            ...(isSelected && {
                                backgroundColor: theme.palette.primary.main,
                                color: theme.palette.primary.contrastText,
                            }),
                        }}
                    />
                );
            })}
        </Box>
    );
};

export default SubjectFilter;
