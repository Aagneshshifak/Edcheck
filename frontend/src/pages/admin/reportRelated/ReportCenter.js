import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Box, Paper, Button, MenuItem, Select,
    FormControl, InputLabel, TextField, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, CircularProgress, Alert,
    Divider, Chip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AssessmentIcon from '@mui/icons-material/Assessment';

// ─── Report type config ──────────────────────────────────────────────────────

const REPORT_TYPES = [
    { value: 'studentPerformance', label: 'Student Performance' },
    { value: 'classAttendance',    label: 'Class Attendance' },
    { value: 'teacherActivity',    label: 'Teacher Activity' },
    { value: 'assignmentCompletion', label: 'Assignment Completion' },
];

// Column definitions per report type
const COLUMNS = {
    studentPerformance: [
        { key: 'studentName',  label: 'Student' },
        { key: 'className',    label: 'Class' },
        { key: 'subjectName',  label: 'Subject' },
        { key: 'avgScore',     label: 'Avg Score' },
        { key: 'totalAttempts', label: 'Attempts' },
    ],
    classAttendance: [
        { key: 'studentName',         label: 'Student' },
        { key: 'className',           label: 'Class' },
        { key: 'subjectName',         label: 'Subject' },
        { key: 'attendancePercentage', label: 'Attendance %' },
        { key: 'presentCount',        label: 'Present' },
        { key: 'absentCount',         label: 'Absent' },
    ],
    teacherActivity: [
        { key: 'teacherName',       label: 'Teacher' },
        { key: 'assignmentsCreated', label: 'Assignments' },
        { key: 'testsCreated',      label: 'Tests' },
        { key: 'totalActivity',     label: 'Total Activity' },
    ],
    assignmentCompletion: [
        { key: 'assignmentTitle',  label: 'Assignment' },
        { key: 'className',        label: 'Class' },
        { key: 'subjectName',      label: 'Subject' },
        { key: 'totalStudents',    label: 'Total Students' },
        { key: 'submittedCount',   label: 'Submitted' },
        { key: 'completionRate',   label: 'Completion %' },
    ],
};

// Which filters apply to each report type
const FILTER_CONFIG = {
    studentPerformance:   { showClass: true, showSubject: true, showDateRange: true },
    classAttendance:      { showClass: true, showSubject: false, showDateRange: true },
    teacherActivity:      { showClass: false, showSubject: false, showDateRange: true },
    assignmentCompletion: { showClass: true, showSubject: true, showDateRange: false },
};

// ─── CSV export helper ───────────────────────────────────────────────────────

const exportCSV = (columns, rows, filename) => {
    const header = columns.map((c) => c.label).join(',');
    const body = rows.map((row) =>
        columns.map((c) => {
            const val = row[c.key] ?? '';
            // Wrap in quotes if value contains comma or quote
            const str = String(val).replace(/"/g, '""');
            return str.includes(',') || str.includes('"') ? `"${str}"` : str;
        }).join(',')
    ).join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// ─── PDF export helper (print-based) ────────────────────────────────────────

const exportPDF = (columns, rows, title) => {
    const tableRows = rows.map((row) =>
        `<tr>${columns.map((c) => `<td style="border:1px solid #ccc;padding:6px 10px;">${row[c.key] ?? ''}</td>`).join('')}</tr>`
    ).join('');
    const html = `
        <html><head><title>${title}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h2 { margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 13px; }
            th { background: #1976d2; color: #fff; padding: 8px 10px; border: 1px solid #1565c0; text-align: left; }
            td { border: 1px solid #ccc; padding: 6px 10px; }
            tr:nth-child(even) td { background: #f5f5f5; }
        </style></head>
        <body>
            <h2>${title}</h2>
            <table>
                <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
};

// ─── Preview table ───────────────────────────────────────────────────────────

const PreviewTable = ({ columns, rows }) => (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table size="small">
            <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.100' }}>
                    {columns.map((c) => (
                        <TableCell key={c.key}><strong>{c.label}</strong></TableCell>
                    ))}
                </TableRow>
            </TableHead>
            <TableBody>
                {rows.map((row, i) => (
                    <TableRow key={i} hover>
                        {columns.map((c) => (
                            <TableCell key={c.key}>{row[c.key] ?? '—'}</TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);

// ─── Main component ──────────────────────────────────────────────────────────

const ReportCenter = () => {
    const schoolId = useSelector((state) => state.user.currentUser._id);

    // Filter state
    const [reportType, setReportType] = useState('studentPerformance');
    const [classId, setClassId]       = useState('');
    const [subjectId, setSubjectId]   = useState('');
    const [fromDate, setFromDate]     = useState('');
    const [toDate, setToDate]         = useState('');

    // Class / subject lists for dropdowns
    const [classes, setClasses]   = useState([]);
    const [subjects, setSubjects] = useState([]);

    // Report data state
    const [rows, setRows]       = useState(null);   // null = not yet generated
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const filterCfg = FILTER_CONFIG[reportType];
    const columns   = COLUMNS[reportType];

    // Load classes for filter dropdowns
    useEffect(() => {
        axiosInstance
            .get(`/SclassList/${schoolId}`)
            .then((res) => setClasses(Array.isArray(res.data) ? res.data : []))
            .catch(() => setClasses([]));
    }, [schoolId]);

    // Load subjects when a class is selected
    useEffect(() => {
        if (!classId) { setSubjects([]); setSubjectId(''); return; }
        axiosInstance
            .get(`/AllSubjects/${classId}`)
            .then((res) => setSubjects(Array.isArray(res.data) ? res.data : []))
            .catch(() => setSubjects([]));
    }, [classId]);

    // Reset rows when report type changes
    useEffect(() => {
        setRows(null);
        setError('');
        setClassId('');
        setSubjectId('');
        setFromDate('');
        setToDate('');
    }, [reportType]);

    const handleGenerate = useCallback(() => {
        setLoading(true);
        setError('');
        setRows(null);

        const params = {};
        if (classId)   params.classId   = classId;
        if (subjectId) params.subjectId = subjectId;
        if (fromDate)  params.from      = fromDate;
        if (toDate)    params.to        = toDate;

        const endpointMap = {
            studentPerformance:   `Admin/reports/studentPerformance/${schoolId}`,
            classAttendance:      `Admin/reports/classAttendance/${schoolId}`,
            teacherActivity:      `Admin/reports/teacherActivity/${schoolId}`,
            assignmentCompletion: `Admin/reports/assignmentCompletion/${schoolId}`,
        };

        axiosInstance
            .get(`/${endpointMap[reportType]}`, { params })
            .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
            .catch((err) => setError(err.response?.data?.message || 'Failed to generate report'))
            .finally(() => setLoading(false));
    }, [schoolId, reportType, classId, subjectId, fromDate, toDate]);

    const reportLabel = REPORT_TYPES.find((r) => r.value === reportType)?.label ?? '';

    const handleExportCSV = () => {
        if (!rows || rows.length === 0) return;
        exportCSV(columns, rows, `${reportLabel.replace(/\s+/g, '_')}_report.csv`);
    };

    const handleExportPDF = () => {
        if (!rows || rows.length === 0) return;
        exportPDF(columns, rows, `${reportLabel} Report`);
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Typography variant="h4" gutterBottom>
                <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Report Center
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Select a report type, apply filters, then click Generate to preview and export.
            </Typography>

            {/* ── Filter panel ── */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Report Options</Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    {/* Report type */}
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>Report Type</InputLabel>
                        <Select
                            value={reportType}
                            label="Report Type"
                            onChange={(e) => setReportType(e.target.value)}
                        >
                            {REPORT_TYPES.map((r) => (
                                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Class filter */}
                    {filterCfg.showClass && (
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Class (optional)</InputLabel>
                            <Select
                                value={classId}
                                label="Class (optional)"
                                onChange={(e) => setClassId(e.target.value)}
                            >
                                <MenuItem value=""><em>All Classes</em></MenuItem>
                                {classes.map((c) => (
                                    <MenuItem key={c._id} value={c._id}>{c.sclassName}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Subject filter */}
                    {filterCfg.showSubject && (
                        <FormControl size="small" sx={{ minWidth: 180 }} disabled={!classId}>
                            <InputLabel>Subject (optional)</InputLabel>
                            <Select
                                value={subjectId}
                                label="Subject (optional)"
                                onChange={(e) => setSubjectId(e.target.value)}
                            >
                                <MenuItem value=""><em>All Subjects</em></MenuItem>
                                {subjects.map((s) => (
                                    <MenuItem key={s._id} value={s._id}>{s.subName}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Date range */}
                    {filterCfg.showDateRange && (
                        <>
                            <TextField
                                label="From"
                                type="date"
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                            <TextField
                                label="To"
                                type="date"
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </>
                    )}

                    <Button
                        variant="contained"
                        onClick={handleGenerate}
                        disabled={loading}
                        sx={{ height: 40 }}
                    >
                        {loading ? <CircularProgress size={20} color="inherit" /> : 'Generate'}
                    </Button>
                </Box>
            </Paper>

            {/* ── Error ── */}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* ── Results area ── */}
            {rows !== null && (
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6">{reportLabel} Report</Typography>
                            <Chip label={`${rows.length} row${rows.length !== 1 ? 's' : ''}`} size="small" />
                        </Box>

                        {rows.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<DownloadIcon />}
                                    onClick={handleExportCSV}
                                >
                                    Export CSV
                                </Button>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<PictureAsPdfIcon />}
                                    onClick={handleExportPDF}
                                >
                                    Export PDF
                                </Button>
                            </Box>
                        )}
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    {rows.length === 0 ? (
                        <Alert severity="info">
                            No data available for the selected report criteria. Try adjusting the filters.
                        </Alert>
                    ) : (
                        <PreviewTable columns={columns} rows={rows} />
                    )}
                </Paper>
            )}
        </Container>
    );
};

export default ReportCenter;
