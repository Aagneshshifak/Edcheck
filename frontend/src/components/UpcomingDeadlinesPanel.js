import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Typography, CircularProgress, Button, Chip } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import QuizIcon from '@mui/icons-material/Quiz';
import { fetchDeadlines } from '../redux/deadlinesRelated/deadlinesHandle';
import { getRelativeLabel } from './deadlineUtils';
import { theme } from '../theme/studentTheme';

const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

const DeadlineRow = ({ item }) => {
    const isAssignment = item.type === 'assignment';
    const label = getRelativeLabel(new Date(item.dueDate), new Date());
    const labelColor =
        label === 'Due Today' ? theme.danger :
        label === 'Due Tomorrow' ? theme.warning :
        theme.accent;

    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 1.5,
            borderBottom: `1px solid rgba(30, 144, 255, 0.1)`,
            '&:last-child': { borderBottom: 'none' },
        }}>
            <Box sx={{
                color: isAssignment ? theme.warning : '#a855f7',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
            }}>
                {isAssignment ? <AssignmentIcon fontSize="small" /> : <QuizIcon fontSize="small" />}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{
                    color: theme.text,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {item.title}
                </Typography>
                <Typography sx={{ color: theme.textMuted, fontSize: '0.78rem' }}>
                    {item.subjectName} · {formatDate(item.dueDate)}
                </Typography>
            </Box>
            <Chip
                label={label}
                size="small"
                sx={{
                    bgcolor: `${labelColor}22`,
                    color: labelColor,
                    border: `1px solid ${labelColor}44`,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    flexShrink: 0,
                }}
            />
        </Box>
    );
};

const UpcomingDeadlinesPanel = () => {
    const dispatch = useDispatch();
    const { deadlines, deadlinesLoading, deadlinesError } = useSelector(s => s.deadlines);
    const currentUser = useSelector(s => s.user?.currentUser);

    const handleRetry = () => {
        if (currentUser?._id) {
            dispatch(fetchDeadlines(currentUser._id));
        }
    };

    return (
        <Box sx={{
            background: theme.card,
            border: theme.cardBorder,
            borderRadius: 3,
            p: 3,
            boxShadow: theme.cardShadow,
        }}>
            <Typography sx={{
                color: theme.accent,
                fontWeight: 700,
                mb: 2,
                fontSize: '1rem',
                letterSpacing: 0.5,
            }}>
                Upcoming Deadlines
            </Typography>

            {deadlinesLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: theme.accent }} />
                </Box>
            )}

            {!deadlinesLoading && deadlinesError && (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography sx={{ color: theme.danger, mb: 2, fontSize: '0.9rem' }}>
                        Failed to load deadlines
                    </Typography>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleRetry}
                        sx={{
                            color: theme.accent,
                            borderColor: theme.accent,
                            '&:hover': { borderColor: theme.accentDark, bgcolor: theme.accentGlow },
                        }}
                    >
                        Retry
                    </Button>
                </Box>
            )}

            {!deadlinesLoading && !deadlinesError && deadlines.length === 0 && (
                <Typography sx={{ color: theme.textMuted, textAlign: 'center', py: 3 }}>
                    No upcoming deadlines
                </Typography>
            )}

            {!deadlinesLoading && !deadlinesError && deadlines.length > 0 && (
                <Box>
                    {deadlines.map((item) => (
                        <DeadlineRow key={item.id || item._id} item={item} />
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default UpcomingDeadlinesPanel;
