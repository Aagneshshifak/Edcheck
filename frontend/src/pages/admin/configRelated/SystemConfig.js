import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Box, Paper, Tabs, Tab,
    TextField, Button, Switch, FormControlLabel,
    Alert, IconButton, Grid,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SkeletonTable from '../../../components/SkeletonTable';
import { useToast } from '../../../context/ToastContext';


const DEFAULT_GRADING_SCALE = [
    { letter: 'A', min: 90, max: 100 },
    { letter: 'B', min: 80, max: 89 },
    { letter: 'C', min: 70, max: 79 },
    { letter: 'D', min: 60, max: 69 },
    { letter: 'F', min: 0,  max: 59 },
];

const TOGGLE_META = [
    { key: 'leaderboard',  label: 'Student Leaderboard',    description: 'Show leaderboard rankings to students' },
    { key: 'parentPortal', label: 'Parent Portal Access',   description: 'Allow parents to log in and view student data' },
    { key: 'fileUploads',  label: 'Assignment File Uploads', description: 'Allow students to upload files for assignments' },
    { key: 'testRetake',   label: 'Test Retake',            description: 'Allow students to retake tests' },
];

function TabPanel({ children, value, index }) {
    return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

const SystemConfig = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);
    const { showSuccess, showError } = useToast();

    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);

    // Tab 1 — School Year
    const [academicYear, setAcademicYear] = useState('');
    const [termStart, setTermStart]       = useState('');
    const [termEnd, setTermEnd]           = useState('');
    const [dateError, setDateError]       = useState('');

    // Tab 2 — Grading Scale
    const [bands, setBands]           = useState(DEFAULT_GRADING_SCALE);
    const [scaleError, setScaleError] = useState('');

    // Tab 3 — Feature Toggles
    const [toggles, setToggles] = useState({
        leaderboard: true,
        parentPortal: true,
        fileUploads: true,
        testRetake: true,
    });

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/Admin/config/${schoolId}`);
            const cfg = res.data;
            setAcademicYear(cfg.academicYear || '');
            setTermStart(cfg.termStart ? cfg.termStart.slice(0, 10) : '');
            setTermEnd(cfg.termEnd   ? cfg.termEnd.slice(0, 10)   : '');
            if (cfg.gradingScale && cfg.gradingScale.length > 0) {
                setBands(cfg.gradingScale);
            }
            if (cfg.featureToggles) {
                setToggles(t => ({ ...t, ...cfg.featureToggles }));
            }
        } catch (err) {
            showError(err.response?.data?.message || 'Failed to load configuration');
        } finally {
            setLoading(false);
        }
    }, [schoolId, showError]);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    // ── Tab 1: School Year ──────────────────────────────────────────────────
    const handleSaveSchoolYear = async () => {
        setDateError('');
        if (termStart && termEnd && termEnd < termStart) {
            setDateError('Term end date must be on or after term start date.');
            return;
        }
        try {
            await axiosInstance.put(`/Admin/config/${schoolId}`, { academicYear, termStart, termEnd });
            showSuccess('School year settings saved.');
        } catch (err) {
            showError(err.response?.data?.message || 'Failed to save school year settings.');
        }
    };

    // ── Tab 2: Grading Scale ────────────────────────────────────────────────
    const handleBandChange = (idx, field, value) => {
        setBands(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
    };

    const handleAddBand = () => {
        setBands(prev => [...prev, { letter: '', min: 0, max: 0 }]);
    };

    const handleRemoveBand = (idx) => {
        setBands(prev => prev.filter((_, i) => i !== idx));
    };

    const handleResetDefault = () => {
        setBands(DEFAULT_GRADING_SCALE);
        setScaleError('');
    };

    const handleSaveGradingScale = async () => {
        setScaleError('');
        try {
            await axiosInstance.put(`/Admin/config/${schoolId}`, { gradingScale: bands });
            showSuccess('Grading scale saved.');
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to save grading scale.';
            setScaleError(msg);
        }
    };

    // ── Tab 3: Feature Toggles ──────────────────────────────────────────────
    const handleToggle = async (key, newValue) => {
        const prev = toggles[key];
        setToggles(t => ({ ...t, [key]: newValue }));
        try {
            await axiosInstance.put(`/Admin/config/${schoolId}`, {
                featureToggles: { [key]: newValue },
            });
            showSuccess('Feature toggle updated.');
        } catch (err) {
            setToggles(t => ({ ...t, [key]: prev }));
            showError(err.response?.data?.message || 'Failed to update feature toggle.');
        }
    };

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
                <Typography variant="h4" sx={{ mb: 3 }}>System Configuration</Typography>
                <SkeletonTable rows={6} cols={3} />
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Typography variant="h4" sx={{ mb: 3 }}>System Configuration</Typography>

            <Paper>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label="School Year" />
                    <Tab label="Grading Scale" />
                    <Tab label="Feature Toggles" />
                </Tabs>

                <Box sx={{ p: 3 }}>
                    {/* ── Tab 1: School Year ── */}
                    <TabPanel value={tab} index={0}>
                        <Grid container spacing={3} maxWidth="sm">
                            <Grid item xs={12}>
                                <TextField
                                    label="Academic Year"
                                    placeholder="e.g. 2024-2025"
                                    value={academicYear}
                                    onChange={e => setAcademicYear(e.target.value)}
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Term Start"
                                    type="date"
                                    value={termStart}
                                    onChange={e => { setTermStart(e.target.value); setDateError(''); }}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    label="Term End"
                                    type="date"
                                    value={termEnd}
                                    onChange={e => { setTermEnd(e.target.value); setDateError(''); }}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            {dateError && (
                                <Grid item xs={12}>
                                    <Alert severity="error">{dateError}</Alert>
                                </Grid>
                            )}
                            <Grid item xs={12}>
                                <Button variant="contained" onClick={handleSaveSchoolYear}>
                                    Save School Year
                                </Button>
                            </Grid>
                        </Grid>
                    </TabPanel>

                    {/* ── Tab 2: Grading Scale ── */}
                    <TabPanel value={tab} index={1}>
                        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddBand}>
                                Add Band
                            </Button>
                            <Button variant="outlined" color="secondary" onClick={handleResetDefault}>
                                Reset to Default
                            </Button>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                            {bands.map((band, idx) => (
                                <Box key={idx} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <TextField
                                        label="Letter"
                                        value={band.letter}
                                        onChange={e => handleBandChange(idx, 'letter', e.target.value)}
                                        sx={{ width: 90 }}
                                        inputProps={{ maxLength: 2 }}
                                    />
                                    <TextField
                                        label="Min"
                                        type="number"
                                        value={band.min}
                                        onChange={e => handleBandChange(idx, 'min', Number(e.target.value))}
                                        sx={{ width: 100 }}
                                        inputProps={{ min: 0, max: 100 }}
                                    />
                                    <TextField
                                        label="Max"
                                        type="number"
                                        value={band.max}
                                        onChange={e => handleBandChange(idx, 'max', Number(e.target.value))}
                                        sx={{ width: 100 }}
                                        inputProps={{ min: 0, max: 100 }}
                                    />
                                    <IconButton
                                        aria-label="remove band"
                                        color="error"
                                        onClick={() => handleRemoveBand(idx)}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>

                        {scaleError && (
                            <Alert severity="error" sx={{ mb: 2 }}>{scaleError}</Alert>
                        )}

                        <Button variant="contained" onClick={handleSaveGradingScale}>
                            Save Grading Scale
                        </Button>
                    </TabPanel>

                    {/* ── Tab 3: Feature Toggles ── */}
                    <TabPanel value={tab} index={2}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {TOGGLE_META.map(({ key, label, description }) => (
                                <Paper key={key} variant="outlined" sx={{ p: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight={600}>{label}</Typography>
                                            <Typography variant="body2" color="text.secondary">{description}</Typography>
                                        </Box>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={!!toggles[key]}
                                                    onChange={e => handleToggle(key, e.target.checked)}
                                                    color="primary"
                                                />
                                            }
                                            label={toggles[key] ? 'Enabled' : 'Disabled'}
                                            labelPlacement="start"
                                        />
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    </TabPanel>
                </Box>
            </Paper>
        </Container>
    );
};

export default SystemConfig;
