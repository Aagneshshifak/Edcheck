import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Grid, CircularProgress, Avatar, Button, InputAdornment, TextField } from '@mui/material';
import { School, Tag, OpenInNew, FamilyRestroom, Search } from '@mui/icons-material';
import axiosInstance from '../../utils/axiosInstance';

const AVATAR_COLORS = ['#0ea5e9','#a78bfa','#34d399','#f59e0b','#f472b6','#60a5fa'];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

// ── Glass card ────────────────────────────────────────────────────────────────
const ChildCard = ({ child, onOpen }) => {
    const className = child.sclassName?.className || child.sclassName?.sclassName || '—';
    const initials  = (child.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const color     = avatarColor(child.name);

    return (
        <Box
            onClick={() => onOpen(child._id)}
            sx={{
                position: 'relative',
                // Glass effect
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid rgba(255,255,255,0.12)`,
                borderRadius: 4,
                p: 3,
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                '&:hover': {
                    transform: 'translateY(-5px)',
                    borderColor: `rgba(255,255,255,0.25)`,
                    boxShadow: `0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)`,
                },
                // top accent bar
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, ${color}, ${color}55)`,
                    borderRadius: '4px 4px 0 0',
                },
                boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
        >
            {/* Avatar */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
                <Avatar sx={{
                    width: 72, height: 72,
                    fontSize: '1.5rem', fontWeight: 700,
                    bgcolor: `${color}22`, color,
                    border: `2px solid ${color}55`,
                    boxShadow: `0 0 20px ${color}30`,
                }}>
                    {initials}
                </Avatar>
            </Box>

            <Typography sx={{ color: '#ffffff', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center', mb: 0.5 }}>
                {child.name}
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Box sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    background: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px', px: '10px', py: '4px',
                }}>
                    <School sx={{ fontSize: '0.75rem', color: '#ffffff' }} />
                    <Typography sx={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: 600 }}>{className}</Typography>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.8, mb: 3 }}>
                <Tag sx={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>
                    Roll No: <span style={{ color: '#ffffff', fontWeight: 600 }}>{child.rollNum ?? '—'}</span>
                </Typography>
            </Box>

            <Button
                fullWidth
                variant="contained"
                endIcon={<OpenInNew sx={{ fontSize: '0.9rem !important' }} />}
                onClick={e => { e.stopPropagation(); onOpen(child._id); }}
                sx={{
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#ffffff',
                    fontWeight: 700,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontSize: '0.88rem',
                    py: 1,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
                    '&:hover': {
                        background: 'rgba(255,255,255,0.22)',
                        borderColor: 'rgba(255,255,255,0.4)',
                    },
                }}
            >
                Open Dashboard
            </Button>
        </Box>
    );
};

const MyChildrenPage = () => {
    const { currentUser } = useSelector(s => s.user);
    const navigate = useNavigate();
    const [children, setChildren] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);
    const [search,   setSearch]   = useState('');

    useEffect(() => {
        if (!currentUser?._id) return;
        axiosInstance.get(`/Parent/children/${currentUser._id}`)
            .then(res => setChildren(Array.isArray(res.data) ? res.data : []))
            .catch(() => setError('Failed to load children. Please refresh.'))
            .finally(() => setLoading(false));
    }, [currentUser?._id]);

    const handleOpen = (childId) => {
        localStorage.setItem('selectedChild', childId);
        navigate(`/Parent/student/${childId}`);
    };

    if (loading) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: '#ffffff' }} />
        </Box>
    );

    if (error) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: '#ef4444' }}>{error}</Typography>
        </Box>
    );

    return (
        <Box sx={{ p: { xs: 2, md: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                <FamilyRestroom sx={{ fontSize: '1.8rem' }} />
                <Typography sx={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                    My Children
                </Typography>
            </Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', mb: children.length > 1 ? 2 : 4, ml: 0.5 }}>
                {children.length} {children.length === 1 ? 'child' : 'children'} linked to your account
            </Typography>

            {children.length > 1 && (
                <TextField
                    placeholder="Search child..."
                    size="small"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    sx={{
                        mb: 3, maxWidth: 320, display: 'block',
                        '& .MuiOutlinedInput-root': {
                            bgcolor: 'rgba(255,255,255,0.06)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: 2.5,
                        },
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.1rem' }} />
                            </InputAdornment>
                        ),
                    }}
                />
            )}

            {children.length === 0 ? (
                <Box sx={{
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4, p: 6, textAlign: 'center',
                }}>
                    <FamilyRestroom sx={{ opacity: 0.2, fontSize: '3rem', mb: 1 }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)' }}>
                        No children linked to this account yet.
                    </Typography>
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {children
                        .filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
                        .map(child => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={child._id}>
                                <ChildCard child={child} onOpen={handleOpen} />
                            </Grid>
                        ))}
                </Grid>
            )}
        </Box>
    );
};

export default MyChildrenPage;
