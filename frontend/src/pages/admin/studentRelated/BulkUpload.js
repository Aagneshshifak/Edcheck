import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Button, Alert, CircularProgress,
    Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
    Chip, Divider, List, ListItem, ListItemText,
} from '@mui/material';
import UploadFileIcon  from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DownloadIcon    from '@mui/icons-material/Download';

const BASE = process.env.REACT_APP_BASE_URL;

// Generate a sample Excel template as a downloadable CSV
const downloadTemplate = () => {
    const csv = 'Name,RollNum,Class,ParentName,Phone\nRahul Sharma,1,Class 6 Section A,Ramesh Sharma,9876543210\nSneha Patel,2,Class 6 Section A,Sunita Patel,9876543211';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'student_upload_template.csv';
    a.click(); URL.revokeObjectURL(url);
};

const BulkUpload = () => {
    const schoolId  = useSelector(s => s.user.currentUser._id);
    const adminName = useSelector(s => s.user.currentUser.name || 'Admin');

    const [file,     setFile]     = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result,   setResult]   = useState(null);
    const [error,    setError]    = useState('');
    const inputRef = useRef();

    const handleFile = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            setError('Only .xlsx, .xls, or .csv files are supported');
            return;
        }
        setFile(f); setResult(null); setError('');
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true); setError(''); setResult(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('schoolId', schoolId);
            fd.append('adminName', adminName);
            const { data } = await axios.post(`${BASE}/Admin/bulk/students`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(data);
            setFile(null);
            if (inputRef.current) inputRef.current.value = '';
        } catch (e) {
            setError(e.response?.data?.message || 'Upload failed');
        } finally { setUploading(false); }
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
            <Typography variant="h4" gutterBottom>
                <UploadFileIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Bulk Upload Students
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Upload an Excel (.xlsx) or CSV file to add multiple students at once.
            </Typography>

            {error  && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {result && (
                <Alert severity={result.skipped > 0 ? 'warning' : 'success'} icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                    <strong>{result.message}</strong>
                </Alert>
            )}

            {/* Template download */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Required Columns</Typography>
                <TableContainer>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                {['Column', 'Required', 'Example'].map(h => <TableCell key={h}><strong>{h}</strong></TableCell>)}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {[
                                ['Name',       true,  'Rahul Sharma'],
                                ['RollNum',    true,  '1'],
                                ['Class',      true,  'Class 6 Section A'],
                                ['ParentName', false, 'Ramesh Sharma'],
                                ['Phone',      false, '9876543210'],
                            ].map(([col, req, ex]) => (
                                <TableRow key={col}>
                                    <TableCell><code>{col}</code></TableCell>
                                    <TableCell><Chip label={req ? 'Required' : 'Optional'} size="small" color={req ? 'error' : 'default'} /></TableCell>
                                    <TableCell><Typography variant="caption" color="text.secondary">{ex}</Typography></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Button size="small" startIcon={<DownloadIcon />} onClick={downloadTemplate} sx={{ mt: 1.5 }}>
                    Download Template CSV
                </Button>
            </Paper>

            {/* Upload area */}
            <Paper
                sx={{
                    p: 4, textAlign: 'center', border: '2px dashed',
                    borderColor: file ? 'primary.main' : 'grey.400',
                    bgcolor: file ? 'rgba(14,165,233,0.04)' : 'transparent',
                    cursor: 'pointer', borderRadius: 2,
                }}
                onClick={() => inputRef.current?.click()}
            >
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleFile} />
                <UploadFileIcon sx={{ fontSize: 48, color: file ? 'primary.main' : 'grey.400', mb: 1 }} />
                {file ? (
                    <Typography fontWeight={600} color="primary">{file.name}</Typography>
                ) : (
                    <Typography color="text.secondary">Click to select or drag & drop your Excel / CSV file</Typography>
                )}
            </Paper>

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                    variant="contained" size="large" startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}
                    onClick={handleUpload} disabled={!file || uploading}
                >
                    {uploading ? 'Uploading…' : 'Upload Students'}
                </Button>
                {file && <Button variant="outlined" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }}>Clear</Button>}
            </Box>

            {/* Results */}
            {result && result.errors?.length > 0 && (
                <Paper sx={{ mt: 3, p: 2 }}>
                    <Divider sx={{ mb: 1 }}>
                        <Chip label={`${result.errors.length} skipped rows`} color="warning" size="small" />
                    </Divider>
                    <List dense>
                        {result.errors.map((e, i) => (
                            <ListItem key={i} sx={{ py: 0.25 }}>
                                <ListItemText primary={<Typography variant="caption" color="error">{e}</Typography>} />
                            </ListItem>
                        ))}
                    </List>
                </Paper>
            )}
        </Container>
    );
};

export default BulkUpload;
