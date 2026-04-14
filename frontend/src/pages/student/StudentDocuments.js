import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Typography, Paper, Button, CircularProgress,
    Alert, Chip, IconButton, Tooltip, LinearProgress,
} from '@mui/material';
import FolderIcon          from '@mui/icons-material/Folder';
import UploadFileIcon      from '@mui/icons-material/UploadFile';
import DeleteIcon          from '@mui/icons-material/Delete';
import OpenInNewIcon       from '@mui/icons-material/OpenInNew';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

const ALLOWED = '.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png';

// File type → MUI color name
const FILE_COLOR = {
    pdf: 'error', doc: 'primary', docx: 'primary',
    ppt: 'warning', pptx: 'warning',
    jpg: 'success', jpeg: 'success', png: 'success',
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
    const [deleting,  setDeleting]  = useState(null);

    const inputRef = useRef();

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
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#111111', minHeight: '100vh' }}>

            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <FolderIcon sx={{ fontSize: '1.6rem' }} />
                    <Box>
                        <Typography fontWeight={800} fontSize="1.3rem" lineHeight={1.2}>
                            My Documents
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {docs.length} document{docs.length !== 1 ? 's' : ''} stored
                        </Typography>
                    </Box>
                </Box>

                <Button
                    variant="contained"
                    startIcon={<UploadFileIcon />}
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                    sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700 }}
                >
                    Upload Documents
                </Button>
                <input ref={inputRef} type="file" multiple accept={ALLOWED} hidden onChange={handleUpload} />
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Upload progress */}
            {uploading && (
                <Paper variant="outlined" sx={{ borderRadius: 3, p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
                        <Typography variant="body2" color="text.secondary">Uploading…</Typography>
                        <Typography variant="body2" fontWeight={700}>{progress}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
                </Paper>
            )}

            {/* Document list */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                    <CircularProgress />
                </Box>
            ) : docs.length === 0 ? (
                <Paper variant="outlined" sx={{ borderRadius: 3, p: 6, textAlign: 'center' }}>
                    <FolderIcon sx={{ fontSize: '3.5rem', opacity: 0.2, mb: 1 }} />
                    <Typography color="text.secondary">No documents uploaded yet</Typography>
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                        Upload PDFs, Word docs, images and more
                    </Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {docs.map((doc, i) => {
                        const ext        = doc.fileType || doc.documentName?.split('.').pop()?.toLowerCase() || '';
                        const chipColor  = FILE_COLOR[ext] || 'default';
                        const isDeleting = deleting === doc.publicId;

                        return (
                            <Paper key={i} variant="outlined" sx={{
                                borderRadius: 3, p: 2,
                                display: 'flex', alignItems: 'center', gap: 2,
                                transition: 'box-shadow 0.15s',
                                '&:hover': { boxShadow: 2 },
                            }}>
                                {/* File icon */}
                                <Box sx={{
                                    width: 44, height: 44, borderRadius: 2, flexShrink: 0,
                                    bgcolor: 'action.hover',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <InsertDriveFileIcon color={chipColor} sx={{ fontSize: '1.3rem' }} />
                                </Box>

                                {/* Name + meta */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography fontWeight={600} fontSize="0.88rem"
                                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {doc.documentName}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                                        <Chip
                                            label={ext.toUpperCase() || 'FILE'}
                                            size="small"
                                            color={chipColor}
                                            variant="outlined"
                                            sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }}
                                        />
                                        {doc.size && (
                                            <Typography variant="caption" color="text.disabled">
                                                {formatSize(doc.size)}
                                            </Typography>
                                        )}
                                        {doc.uploadedAt && (
                                            <Typography variant="caption" color="text.disabled">
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
                                        >
                                            <OpenInNewIcon sx={{ fontSize: '1rem' }} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            disabled={isDeleting || !doc.publicId}
                                            onClick={() => handleDelete(doc.publicId, doc.documentName)}
                                        >
                                            {isDeleting
                                                ? <CircularProgress size={14} color="error" />
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
