import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllNotices } from '../redux/noticeRelated/noticeHandle';
import { Box, Typography, CircularProgress } from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

const SeeNotice = () => {
    const dispatch = useDispatch();
    const { currentUser, currentRole } = useSelector((s) => s.user);
    const { noticesList, loading, response } = useSelector((s) => s.notice);

    useEffect(() => {
        const schoolId = currentRole === 'Admin'
            ? currentUser._id
            : currentUser.school?._id || currentUser.schoolId;
        if (schoolId) dispatch(getAllNotices(schoolId, 'Notice'));
    }, [dispatch, currentRole, currentUser]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} sx={{ color: '#1e90ff' }} />
            </Box>
        );
    }

    if (response || !Array.isArray(noticesList) || noticesList.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <CampaignIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.2)', mb: 1 }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                    No notices right now
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {noticesList.map((notice) => {
                const dateStr = notice.date
                    ? new Date(notice.date).toLocaleDateString(undefined, {
                          day: 'numeric', month: 'short', year: 'numeric',
                      })
                    : '—';

                return (
                    <Box key={notice._id} sx={{
                        background: 'rgba(14,165,233,0.05)',
                        border: '1px solid rgba(14,165,233,0.15)',
                        borderLeft: '3px solid #0ea5e9',
                        borderRadius: 2,
                        p: 2,
                        transition: 'background 0.2s',
                        '&:hover': { background: 'rgba(14,165,233,0.1)' },
                    }}>
                        {/* Title row */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                            <Typography sx={{
                                color: '#e8f4fd',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                lineHeight: 1.3,
                                flex: 1,
                            }}>
                                {notice.title}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                <CalendarTodayIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} />
                                <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                    {dateStr}
                                </Typography>
                            </Box>
                        </Box>

                        {/* Description */}
                        <Typography sx={{
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.8rem',
                            lineHeight: 1.5,
                        }}>
                            {notice.details}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    );
};

export default SeeNotice;
