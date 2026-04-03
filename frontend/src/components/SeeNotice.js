import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllNotices } from '../redux/noticeRelated/noticeHandle';
import { Box, Typography, CircularProgress, Chip, Collapse, IconButton } from '@mui/material';
import CampaignIcon      from '@mui/icons-material/Campaign';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ExpandMoreIcon    from '@mui/icons-material/ExpandMore';
import ExpandLessIcon    from '@mui/icons-material/ExpandLess';

const SEEN_KEY = 'seenNotices';

const getSeenIds = () => {
    try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); }
    catch { return new Set(); }
};
const markSeen = (ids) => {
    const existing = getSeenIds();
    ids.forEach(id => existing.add(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...existing]));
};

const SeeNotice = () => {
    const dispatch = useDispatch();
    const { currentUser, currentRole } = useSelector(s => s.user);
    const { noticesList, loading, response } = useSelector(s => s.notice);

    const [expanded, setExpanded] = useState({}); // { noticeId: bool }
    const [seenIds,  setSeenIds]  = useState(getSeenIds);

    useEffect(() => {
        const schoolId = currentRole === 'Admin'
            ? currentUser._id
            : currentUser.school?._id || currentUser.schoolId;
        if (schoolId) dispatch(getAllNotices(schoolId, 'Notice'));
    }, [dispatch, currentRole, currentUser]);

    // Mark all visible notices as seen after render
    useEffect(() => {
        if (!Array.isArray(noticesList) || noticesList.length === 0) return;
        const ids = noticesList.map(n => n._id);
        markSeen(ids);
        setSeenIds(getSeenIds());
    }, [noticesList]);

    const unreadCount = Array.isArray(noticesList)
        ? noticesList.filter(n => !seenIds.has(n._id)).length
        : 0;

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#0ea5e9' }} />
        </Box>
    );

    if (response || !Array.isArray(noticesList) || noticesList.length === 0) return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
            <CampaignIcon sx={{ fontSize: 40, color: 'rgba(255,255,255,0.15)', mb: 1 }} />
            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
                No notices right now
            </Typography>
        </Box>
    );

    return (
        <Box>
            {/* Unread badge */}
            {unreadCount > 0 && (
                <Box sx={{ mb: 1.5 }}>
                    <Chip
                        label={`${unreadCount} new`}
                        size="small"
                        sx={{
                            bgcolor: 'rgba(14,165,233,0.15)', color: '#0ea5e9',
                            border: '1px solid rgba(14,165,233,0.35)',
                            fontWeight: 700, fontSize: '0.7rem',
                        }}
                    />
                </Box>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {noticesList.map(notice => {
                    const isNew  = !seenIds.has(notice._id);
                    const isOpen = expanded[notice._id] ?? false;
                    const dateStr = notice.date
                        ? new Date(notice.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—';

                    return (
                        <Box key={notice._id} sx={{
                            background: isNew ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.03)',
                            border: `1px solid ${isNew ? 'rgba(14,165,233,0.3)' : 'rgba(14,165,233,0.12)'}`,
                            borderLeft: `3px solid ${isNew ? '#0ea5e9' : 'rgba(14,165,233,0.35)'}`,
                            borderRadius: 2, p: 2,
                            transition: 'background 0.2s',
                            '&:hover': { background: 'rgba(14,165,233,0.1)' },
                        }}>
                            {/* Title row */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                                    {isNew && (
                                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#0ea5e9', flexShrink: 0 }} />
                                    )}
                                    <Typography sx={{
                                        color: '#e8f4fd', fontWeight: 600, fontSize: '0.88rem',
                                        lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {notice.title}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                    <CalendarTodayIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }} />
                                    <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>{dateStr}</Typography>
                                    <IconButton size="small" onClick={() => setExpanded(p => ({ ...p, [notice._id]: !isOpen }))}
                                        sx={{ color: 'rgba(255,255,255,0.3)', p: 0.3 }}>
                                        {isOpen ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                                    </IconButton>
                                </Box>
                            </Box>

                            {/* Expandable details */}
                            <Collapse in={isOpen}>
                                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', lineHeight: 1.6, mt: 1 }}>
                                    {notice.details}
                                </Typography>
                                {notice.targetType && notice.targetType !== 'all' && (
                                    <Chip label={`→ ${notice.targetType}`} size="small" sx={{
                                        mt: 1, bgcolor: 'rgba(167,139,250,0.12)', color: '#a78bfa',
                                        border: '1px solid rgba(167,139,250,0.3)', fontSize: '0.65rem',
                                    }} />
                                )}
                                {/* Attachments */}
                                {notice.attachments?.length > 0 && (
                                    <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {notice.attachments.map((a, i) => (
                                            <Box key={i} component="a" href={a.fileUrl} target="_blank" rel="noopener noreferrer"
                                                sx={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                                                    bgcolor: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.3)',
                                                    borderRadius: 1.5, px: 1.2, py: 0.4,
                                                    color: '#0ea5e9', fontSize: '0.72rem', textDecoration: 'none',
                                                    '&:hover': { bgcolor: 'rgba(14,165,233,0.2)' },
                                                }}>
                                                📎 {a.fileName}
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </Collapse>

                            {/* Preview when collapsed */}
                            {!isOpen && (
                                <Typography sx={{
                                    color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem',
                                    mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {notice.details}
                                </Typography>
                            )}
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

export default SeeNotice;
