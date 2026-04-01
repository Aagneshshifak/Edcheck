import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Tabs, Tab, Button,
    Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
    Alert, CircularProgress, Dialog, DialogTitle, DialogContent,
    DialogActions, Chip, Pagination, Collapse, IconButton,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import StorageIcon from '@mui/icons-material/Storage';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import SkeletonTable from '../../../components/SkeletonTable';
import { useToast } from '../../../context/ToastContext';

const BASE = process.env.REACT_APP_BASE_URL;

// ── Tab panel helper ──────────────────────────────────────────────────────────
const TabPanel = ({ children, value, index }) => (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 3 }}>
        {value === index && children}
    </Box>
);

// ── Import History expandable row ─────────────────────────────────────────────
const ImportRow = ({ log }) => {
    const [open, setOpen] = useState(false);

    let details = null;
    try { details = log.details ? JSON.parse(log.details) : null; } catch { details = null; }

    const failures = details?.errors || details?.failures || [];
    const totalRows = details?.total ?? details?.totalRows ?? '—';
    const successCount = details?.success ?? details?.successCount ?? '—';
    const failureCount = details?.failed ?? details?.failureCount ?? (Array.isArray(failures) ? failures.length : '—');

    return (
        <>
            <TableRow hover>
                <TableCell>
                    <IconButton size="small" onClick={() => setOpen(o => !o)}>
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                <TableCell>{details?.fileName || details?.filename || '—'}</TableCell>
                <TableCell>
                    <Chip label={log.targetType || log.action || '—'} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{totalRows}</TableCell>
                <TableCell>
                    <Chip label={successCount} size="small" color="success" variant="outlined" />
                </TableCell>
                <TableCell>
                    <Chip label={failureCount} size="small" color={failureCount > 0 ? 'error' : 'default'} variant="outlined" />
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell colSpan={7} sx={{ py: 0 }}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ m: 1 }}>
                            {failures.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                    No failures recorded.
                                </Typography>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>Row</strong></TableCell>
                                            <TableCell><strong>Reason</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {failures.map((f, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{f.row ?? i + 1}</TableCell>
                                                <TableCell>{f.reason || f.message || String(f)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
};

// ── Main component ────────────────────────────────────────────────────────────
const DataManager = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);
    const { showSuccess, showError } = useToast();
    const [tab, setTab] = useState(0);

    // ── Tab 2: Import History state ───────────────────────────────────────────
    const [importLogs, setImportLogs] = useState([]);
    const [importTotal, setImportTotal] = useState(0);
    const [importPage, setImportPage] = useState(1);
    const [importPages, setImportPages] = useState(1);
    const [importLoading, setImportLoading] = useState(false);

    // ── Tab 3: Cleanup state ──────────────────────────────────────────────────
    const [orphans, setOrphans] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ── Tab 2: fetch import history ───────────────────────────────────────────
    const fetchImportHistory = useCallback(async (page = 1) => {
        setImportLoading(true);
        try {
            const { data } = await axios.get(
                `${BASE}/Admin/data/importHistory/${schoolId}?page=${page}&limit=20`
            );
            setImportLogs(data.logs || []);
            setImportTotal(data.total || 0);
            setImportPage(data.page || page);
            setImportPages(data.pages || 1);
        } catch {
            showError('Failed to load import history');
        } finally {
            setImportLoading(false);
        }
    }, [schoolId, showError]);

    useEffect(() => {
        if (tab === 1) fetchImportHistory(importPage);
    }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Tab 1: Export helpers ─────────────────────────────────────────────────
    const triggerDownload = (url) => {
        try {
            const a = document.createElement('a');
            a.href = url;
            a.click();
        } catch {
            showError('Download failed. Please try again.');
        }
    };

    const exportButtons = [
        { label: 'Export Students',    url: `${BASE}/Admin/data/export/students/${schoolId}` },
        { label: 'Export Teachers',    url: `${BASE}/Admin/data/export/teachers/${schoolId}` },
        { label: 'Export Classes',     url: `${BASE}/Admin/data/export/classes/${schoolId}` },
        { label: 'Export Test Results',url: `${BASE}/Admin/data/export/testResults/${schoolId}` },
    ];

    // ── Tab 3: Scan orphans ───────────────────────────────────────────────────
    const scanOrphans = async () => {
        setScanning(true);
        try {
            const { data } = await axios.get(`${BASE}/Admin/data/orphans/${schoolId}`);
            setOrphans(data);
        } catch {
            showError('Orphan scan failed. Please try again.');
        } finally {
            setScanning(false);
        }
    };

    const handleDeleteOrphans = async () => {
        setDeleting(true);
        try {
            await axios.delete(`${BASE}/Admin/data/orphans/${schoolId}`);
            showSuccess('Orphaned records deleted successfully.');
            setDeleteConfirmOpen(false);
            // Re-scan to show updated counts
            const { data } = await axios.get(`${BASE}/Admin/data/orphans/${schoolId}`);
            setOrphans(data);
        } catch {
            showError('Failed to delete orphaned records.');
        } finally {
            setDeleting(false);
        }
    };

    const orphanTotal = orphans
        ? (orphans.orphanedAttempts || 0) + (orphans.orphanedSubmissions || 0) + (orphans.orphanedAttendanceStudents || 0)
        : 0;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <StorageIcon />
                <Typography variant="h4">Data Manager</Typography>
            </Box>

            <Paper>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label="Export" />
                    <Tab label="Import History" />
                    <Tab label="Cleanup" />
                </Tabs>

                {/* ── Tab 1: Export ── */}
                <TabPanel value={tab} index={0}>
                    <Box sx={{ p: 3 }}>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            Download school data as CSV files. Each file includes a date stamp in the filename.
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {exportButtons.map(({ label, url }) => (
                                <Button
                                    key={label}
                                    variant="contained"
                                    startIcon={<DownloadIcon />}
                                    onClick={() => triggerDownload(url)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </Box>
                    </Box>
                </TabPanel>

                {/* ── Tab 2: Import History ── */}
                <TabPanel value={tab} index={1}>
                    <Box sx={{ p: 3 }}>
                        {importLoading ? (
                            <SkeletonTable rows={6} cols={7} />
                        ) : (
                            <>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                                            <TableRow>
                                                <TableCell />
                                                <TableCell><strong>Date</strong></TableCell>
                                                <TableCell><strong>File Name</strong></TableCell>
                                                <TableCell><strong>Record Type</strong></TableCell>
                                                <TableCell><strong>Total Rows</strong></TableCell>
                                                <TableCell><strong>Success</strong></TableCell>
                                                <TableCell><strong>Failures</strong></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {importLogs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                                        <Typography color="text.secondary">No import history found.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                importLogs.map(log => <ImportRow key={log._id} log={log} />)
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                {importPages > 1 && (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                        <Pagination
                                            count={importPages}
                                            page={importPage}
                                            onChange={(_, p) => {
                                                setImportPage(p);
                                                fetchImportHistory(p);
                                            }}
                                            color="primary"
                                        />
                                    </Box>
                                )}

                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    {importTotal} total records
                                </Typography>
                            </>
                        )}
                    </Box>
                </TabPanel>

                {/* ── Tab 3: Cleanup ── */}
                <TabPanel value={tab} index={2}>
                    <Box sx={{ p: 3 }}>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            Scan for orphaned records that reference deleted entities, then remove them to keep the database clean.
                        </Typography>

                        <Button
                            variant="outlined"
                            startIcon={scanning ? <CircularProgress size={16} /> : <SearchIcon />}
                            onClick={scanOrphans}
                            disabled={scanning}
                            sx={{ mb: 3 }}
                        >
                            {scanning ? 'Scanning…' : 'Scan for Orphans'}
                        </Button>

                        {orphans !== null && (
                            <Box sx={{ mt: 1 }}>
                                {orphanTotal === 0 ? (
                                    <Alert severity="success">Database is clean — no orphaned records found.</Alert>
                                ) : (
                                    <>
                                        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                                            <Table size="small">
                                                <TableHead sx={{ bgcolor: 'grey.100' }}>
                                                    <TableRow>
                                                        <TableCell><strong>Type</strong></TableCell>
                                                        <TableCell align="right"><strong>Count</strong></TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    <TableRow>
                                                        <TableCell>Orphaned Test Attempts</TableCell>
                                                        <TableCell align="right">
                                                            <Chip label={orphans.orphanedAttempts} size="small" color={orphans.orphanedAttempts > 0 ? 'warning' : 'default'} />
                                                        </TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell>Orphaned Submissions</TableCell>
                                                        <TableCell align="right">
                                                            <Chip label={orphans.orphanedSubmissions} size="small" color={orphans.orphanedSubmissions > 0 ? 'warning' : 'default'} />
                                                        </TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell>Students with Orphaned Attendance</TableCell>
                                                        <TableCell align="right">
                                                            <Chip label={orphans.orphanedAttendanceStudents} size="small" color={orphans.orphanedAttendanceStudents > 0 ? 'warning' : 'default'} />
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </TableContainer>

                                        <Button
                                            variant="contained"
                                            color="error"
                                            startIcon={<DeleteSweepIcon />}
                                            onClick={() => setDeleteConfirmOpen(true)}
                                        >
                                            Delete Orphans ({orphanTotal})
                                        </Button>
                                    </>
                                )}
                            </Box>
                        )}
                    </Box>
                </TabPanel>
            </Paper>

            {/* ── Delete Confirmation Dialog ── */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Confirm Orphan Deletion</DialogTitle>
                <DialogContent>
                    <Typography gutterBottom>
                        This will permanently delete the following orphaned records:
                    </Typography>
                    {orphans && (
                        <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                            <li>{orphans.orphanedAttempts} test attempt(s)</li>
                            <li>{orphans.orphanedSubmissions} submission(s)</li>
                            <li>Attendance entries for {orphans.orphanedAttendanceStudents} student(s)</li>
                        </Box>
                    )}
                    <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                        This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteOrphans}
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={16} /> : <DeleteSweepIcon />}
                    >
                        {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default DataManager;
