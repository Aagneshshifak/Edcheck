import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    IconButton, Badge, Box, Typography, Divider,
    ClickAwayListener, Paper, Slide,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AssignmentIcon from '@mui/icons-material/Assignment';
import QuizIcon from '@mui/icons-material/Quiz';
import GradeIcon from '@mui/icons-material/Grade';
import FeedbackIcon from '@mui/icons-material/Feedback';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CloseIcon from '@mui/icons-material/Close';
import { fetchNotifications, readNotification, readAllNotifications } from '../redux/notificationRelated/notificationHandle';
import { setNotifications } from '../redux/notificationRelated/notificationSlice';


const TYPE_ICON = {
    assignment: <AssignmentIcon sx={{ fontSize: 16 }} />,
    test:       <QuizIcon sx={{ fontSize: 16 }} />,
    marks:      <GradeIcon sx={{ fontSize: 16 }} />,
    feedback:   <FeedbackIcon sx={{ fontSize: 16 }} />,
};

const TYPE_COLOR = {
    assignment: '#1e90ff',
    test:       '#a855f7',
    marks:      '#22c55e',
    feedback:   '#f59e0b',
};

// ── Toast popup shown when a new notification arrives ────────────────────────
const Toast = ({ notification, onClose }) => {
    const color = TYPE_COLOR[notification.type] || '#1e90ff';

    useEffect(() => {
        const t = setTimeout(onClose, 5000);
        return () => clearTimeout(t);
    }, [onClose]);

    return (
        <Slide direction="up" in mountOnEnter unmountOnExit>
            <Box sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 2000,
                width: 320,
                bgcolor: '#000000',
                border: `1px solid ${color}55`,
                borderLeft: `4px solid ${color}`,
                borderRadius: 2,
                p: 1.5,
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start',
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}22`,
            }}>
                <Box sx={{ color, mt: 0.2, flexShrink: 0 }}>
                    {TYPE_ICON[notification.type] || <NotificationsIcon sx={{ fontSize: 16 }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ color: '#e8f4fd', fontSize: '0.82rem', lineHeight: 1.4 }}>
                        {notification.message}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', mt: 0.3 }}>
                        Just now
                    </Typography>
                </Box>
                <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)', p: 0.25 }}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </Box>
        </Slide>
    );
};

// ── Main bell component ───────────────────────────────────────────────────────
const NotificationBell = () => {
    const dispatch = useDispatch();
    const { currentUser } = useSelector((s) => s.user);
    const { items, hasMore, nextCursor } = useSelector((s) => s.notifications);
    const [open, setOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const unread = items.filter((n) => !n.readStatus).length;

    // Load history once on mount
    useEffect(() => {
        if (currentUser?._id) {
            dispatch(fetchNotifications(currentUser._id));
        }
    }, [dispatch, currentUser?._id]);

    // SSE — real-time push
    useEffect(() => {
        if (!currentUser?._id) return;

        const es = new EventSource(`${process.env.REACT_APP_BASE_URL}/Notifications/stream/${currentUser._id}`);

        es.onmessage = (e) => {
            try {
                const notification = JSON.parse(e.data);
                // Prepend to Redux store preserving hasMore/nextCursor
                dispatch(setNotifications({
                    items: [notification, ...itemsRef.current],
                    hasMore: false,
                    nextCursor: null,
                }));
                setToast(notification);
            } catch (_) {}
        };

        es.onerror = () => {
            // Browser will auto-reconnect; nothing to do
        };

        return () => es.close();
    }, [dispatch, currentUser?._id]);

    const handleMarkOne = (id) => dispatch(readNotification(id));
    const handleMarkAll = () => dispatch(readAllNotifications(currentUser._id));

    return (
        <>
            <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Box sx={{ position: 'relative' }}>
                    <IconButton onClick={() => setOpen((v) => !v)} sx={{ color: '#fff' }}>
                        <Badge badgeContent={unread} color="error" max={99}>
                            <NotificationsIcon />
                        </Badge>
                    </IconButton>

                    {open && (
                        <Paper elevation={8} sx={{
                            position: 'absolute',
                            top: 44,
                            right: 0,
                            width: 340,
                            maxHeight: 420,
                            overflowY: 'auto',
                            zIndex: 1400,
                            bgcolor: '#000000',
                            border: '1px solid rgba(30,144,255,0.2)',
                            borderRadius: 2,
                        }}>
                            <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ color: '#e8f4fd', fontWeight: 700, fontSize: '0.9rem' }}>
                                    Notifications {unread > 0 && `(${unread} new)`}
                                </Typography>
                                {unread > 0 && (
                                    <IconButton size="small" onClick={handleMarkAll} title="Mark all as read"
                                        sx={{ color: '#1e90ff' }}>
                                        <DoneAllIcon fontSize="small" />
                                    </IconButton>
                                )}
                            </Box>
                            <Divider sx={{ borderColor: 'rgba(30,144,255,0.15)' }} />

                            {items.length === 0 ? (
                                <Box sx={{ p: 3, textAlign: 'center' }}>
                                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                                        No notifications yet
                                    </Typography>
                                </Box>
                            ) : (
                                <>
                                {items.map((n) => (
                                    <Box key={n._id}
                                        onClick={() => !n.readStatus && handleMarkOne(n._id)}
                                        sx={{
                                            px: 2, py: 1.5,
                                            display: 'flex', gap: 1.5, alignItems: 'flex-start',
                                            cursor: n.readStatus ? 'default' : 'pointer',
                                            bgcolor: n.readStatus ? 'transparent' : 'rgba(30,144,255,0.06)',
                                            borderLeft: n.readStatus ? '3px solid transparent' : `3px solid ${TYPE_COLOR[n.type] || '#1e90ff'}`,
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                                            transition: 'background 0.15s',
                                        }}>
                                        <Box sx={{ mt: 0.3, color: TYPE_COLOR[n.type] || '#1e90ff', flexShrink: 0 }}>
                                            {TYPE_ICON[n.type] || <NotificationsIcon sx={{ fontSize: 16 }} />}
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography sx={{
                                                color: n.readStatus ? 'rgba(255,255,255,0.5)' : '#e8f4fd',
                                                fontSize: '0.82rem', lineHeight: 1.4,
                                            }}>
                                                {n.message}
                                            </Typography>
                                            <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', mt: 0.3 }}>
                                                {new Date(n.createdAt).toLocaleString()}
                                            </Typography>
                                        </Box>
                                        {!n.readStatus && (
                                            <Box sx={{
                                                width: 8, height: 8, borderRadius: '50%',
                                                bgcolor: TYPE_COLOR[n.type] || '#1e90ff',
                                                flexShrink: 0, mt: 0.5,
                                            }} />
                                        )}
                                    </Box>
                                ))}
                                {hasMore && (
                                    <Box sx={{ p: 1.5, textAlign: 'center', borderTop: '1px solid rgba(30,144,255,0.1)' }}>
                                        <Typography
                                            onClick={() => dispatch(fetchNotifications(currentUser._id, nextCursor))}
                                            sx={{ color: '#0ea5e9', fontSize: '0.78rem', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                                            Load more
                                        </Typography>
                                    </Box>
                                )}
                                </>
                            )}
                        </Paper>
                    )}
                </Box>
            </ClickAwayListener>

            {/* Toast popup */}
            {toast && <Toast notification={toast} onClose={() => setToast(null)} />}
        </>
    );
};

export default NotificationBell;
