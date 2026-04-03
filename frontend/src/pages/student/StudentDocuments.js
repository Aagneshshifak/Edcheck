import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Typography, Paper, Button, CircularProgress,
    Alert, Chip, IconButton, Tooltip, LinearProgress,
} from '@mui/material';
import FolderIcon       from '@mui/icons-material/Folder';
import UploadFileIcon   from '@mui/icons-material/UploadFile';
import DeleteIcon       from '@mui/icons-material/Delete';
import OpenInNewIcon    from '@mui/icons-material/OpenInNew';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

const ALLOWED = '.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png';

const FILE_ICON_COLOR = {
    pdf:  '#ef4444', doc: '#0ea5e9', docx: '#0ea5e9',
    ppt:  '#f97316', pptx: '#f97316',
    jpg:  '#34d399', jpeg: '#34d399', png: '#34d399',
};

const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const StudentDocuments = () => {
    const { currentUser } = useSelector(s => s.user);
    const studentId = currentUser?._id;

    const [docs,      setDocs]      = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [uploading, setUploading] = useState(false);
    const [progress,  setProgress]  = useState(0);
    const [error,     setError]     = useState('');
    const [success,   setSuccess]   = useState('');
    const [deleting,  setDeleting]  = useState(null); // publicId being deleted

    const inputRef = useRef();

    // Load documents
    useEffect(() => {
        if (!studentId) return;
        axiosInstance.get(`/api/student-docs/${studentId}`)
            .then(r => setDocs(r.data || []))
            .catch(() => setError('Failed to load documents.'))
            .finally(() => setLoading(false));
    }, [studentId]);

    const handleUpload = async (e) => {
        const files = e.target.files;
        if (!files?.length) return;
        setUploading(true);
        setError('');
        setSuccess('');
        setProgress(0);

        const formData = new FormData();
        Array.from(files).forEach(f => formData.append('documents', f));

        try {
            const { data } = await axiosInstance.post(
                `/api/student-docs/${studentId}`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (ev) => setProgress(Math.round((ev.loaded * 100) / ev.total)),
                }
            );
            setDocs(data);
            setSuccess(`${files.length} document${files.length > 1 ? 's' : ''} uploaded.`);
        } catch (err) {
            setError(err.response?.data?.message || 'Upload failed.');
        } finally {
            setUploading(false);
            setProgress(0);
            // Reset input so same file can be re-selected
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const handleDelete = async (publicId, docName) => {
        if (!window.confirm(`Delete "${docName}"?`)) return;
        setDeleting(publicId);
        try {
            const { data } = await axiosInstance.delete(
                `/api/student-docs/${studentId}/${encodeURIComponent(publicId)}`
            );
            setDocs(data);
        } catch {
            setError('Failed to delete document.');
        } finally {
            setDeleting(null);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0b1120', minHeight: '100vh' }}>

            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <FolderIcon sx={{ color: '#0ea5e9', fontSize: '1.6rem' }} />
                    <Box>
                        <Typography sx={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.3rem', lineHeight: 1.2 }}>
                            My Documents
                        </Typography>
                        <Typography sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.78rem' }}>
                            {docs.length} document{docs.length !== 1 ? 's' : ''} stored
                        </Typography>
                    </Box>
                </Box>

                <Button
                    variant="contained"
                    startIcon={<UploadFileIcon />}
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                    sx={{
                        bgcolor: '#0ea5e9', color: '#fff', borderRadius: 2.5,
                        textTransform: 'none', fontWeight: 700,
                        boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
                        '&:hover': { bgcolor: '#0284c7' },
                    }}
                >
                    Upload Documents
                </Button>
                <input ref={inputRef} type="file" multiple accept={ALLOWED} hidden onChange={handleUpload} />
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Upload progress */}
            {uploading && (
                <Paper sx={{ bgcolor: '#1e293b', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 3, p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
                        <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.82rem' }}>Uploading…</Typography>
                        <Typography sx={{ color: '#0ea5e9', fontWeight: 700, fontSize: '0.82rem' }}>{progress}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={progress} sx={{
                        height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': { bgcolor: '#0ea5e9', borderRadius: 3 },
                    }} />
                </Paper>
            )}

            {/* Document list */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                    <CircularProgress sx={{ color: '#0ea5e9' }} />
                </Box>
            ) : docs.length === 0 ? (
                <Paper sx={{
                    bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 3, p: 6, textAlign: 'center',
                }}>
                    <FolderIcon sx={{ color: 'rgba(148,163,184,0.2)', fontSize: '3.5rem', mb: 1 }} />
                    <Typography sx={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.9rem' }}>
                        No documents uploaded yet
                    </Typography>
                    <Typography sx={{ color: 'rgba(148,163,184,0.3)', fontSize: '0.78rem', mt: 0.5 }}>
                        Upload PDFs, Word docs, images and more
                    </Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {docs.map((doc, i) => {
                        const ext   = doc.fileType || doc.documentName?.split('.').pop()?.toLowerCase() || '';
                        const color = FILE_ICON_COLOR[ext] || '#64748b';
                        const isDeleting = deleting === doc.publicId;

                        return (
                            <Paper key={i} sx={{
                                bgcolor: '#111827',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: 3, p: 2,
                                display: 'flex', alignItems: 'center', gap: 2,
                                transition: 'border-color 0.15s',
                                '&:hover': { borderColor: 'rgba(14,165,233,0.2)' },
                            }}>
                                {/* File type icon */}
                                <Box sx={{
                                    width: 44, height: 44, borderRadius: 2, flexShrink: 0,
                                    bgcolor: `${color}18`, border: `1px solid ${color}30`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <InsertDriveFileIcon sx={{ color, fontSize: '1.3rem' }} />
                                </Box>

                                {/* Name + meta */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography sx={{
                                        color: '#f1f5f9', fontWeight: 600, fontSize: '0.88rem',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {doc.documentName}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                                        <Chip label={ext.toUpperCase() || 'FILE'} size="small" sx={{
                                            height: 18, fontSize: '0.62rem', fontWeight: 700,
                                            bgcolor: `${color}18`, color, border: `1px solid ${color}30`,
                                        }} />
                                        {doc.size && (
                                            <Typography sx={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.7rem' }}>
                                                {formatSize(doc.size)}
                                            </Typography>
                                        )}
                                        {doc.uploadedAt && (
                                            <Typography sx={{ color: 'rgba(148,163,184,0.35)', fontSize: '0.7rem' }}>
                                                {new Date(doc.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>

                                {/* Actions */}
                                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                    <Tooltip title="Open">
                                        <IconButton
                                            component="a" href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                                            size="small"
                                            sx={{ color: '#0ea5e9', '&:hover': { bgcolor: 'rgba(14,165,233,0.1)' } }}
                                        >
                                            <OpenInNewIcon sx={{ fontSize: '1rem' }} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            size="small"
                                            disabled={isDeleting || !doc.publicId}
                                            onClick={() => handleDelete(doc.publicId, doc.documentName)}
                                            sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
                                        >
                                            {isDeleting
                                                ? <CircularProgress size={14} sx={{ color: '#ef4444' }} />
                                                : <DeleteIcon sx={{ fontSize: '1rem' }} />}
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Paper>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
};

export default StudentDocuments;
