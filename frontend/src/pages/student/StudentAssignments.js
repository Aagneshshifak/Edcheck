import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress, CircularProgress, Alert, Collapse } from '@mui/material';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { theme } from '../../theme/studentTheme';

const ALLOWED = '.pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png';
const getDaysLeft = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

const AssignmentCard = ({ assignment, submission, onUpload }) => {
    const daysLeft = getDaysLeft(assignment.dueDate);
    const isOverdue = daysLeft < 0;
    const isSubmitted = !!submission;
    return (
        <Box sx={{ background: 'linear-gradient(145deg,rgba(13,27,42,.9),rgba(10,22,40,.95))', border: `1px solid ${isSubmitted ? '#00e67644' : isOverdue ? '#ff525244' : 'rgba(30,144,255,.18)'}`, borderRadius: 2, p: 2.5, mb: 2, transition: 'all .2s', '&:hover': { transform: 'translateX(4px)' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '0.95rem' }}>{assignment.title}</Typography>
                    <Typography sx={{ color: theme.accent, fontSize: '0.75rem', mt: 0.3 }}>Topic: {assignment.topic}</Typography>
                </Box>
                {isSubmitted
                    ? <Chip icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label={submission.status === 'graded' ? 'Graded: ' + submission.grade : 'Submitted'} size="small" sx={{ bgcolor: '#00e67622', color: '#00e676', border: '1px solid #00e67644', fontSize: '0.7rem' }} />
                    : <Chip icon={<AccessTimeIcon sx={{ fontSize: 14 }} />} label={isOverdue ? 'Overdue' : daysLeft + 'd left'} size="small" sx={{ bgcolor: (isOverdue ? '#ff5252' : '#ffab40') + '22', color: isOverdue ? '#ff5252' : '#ffab40', border: '1px solid ' + (isOverdue ? '#ff525244' : '#ffab4044'), fontSize: '0.7rem' }} />
                }
            </Box>
            {assignment.description && <Typography sx={{ color: theme.textMuted, fontSize: '0.8rem', mb: 1.5 }}>{assignment.description}</Typography>}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Typography sx={{ color: theme.textMuted, fontSize: '0.72rem' }}>Due: {new Date(assignment.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Typography>
                {isSubmitted
                    ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><InsertDriveFileIcon sx={{ color: theme.accent, fontSize: 14 }} /><Typography sx={{ color: theme.accent, fontSize: '0.72rem' }}>{submission.fileName}</Typography></Box>
                    : <Button size="small" startIcon={<UploadFileIcon />} onClick={() => onUpload(assignment)} sx={{ background: 'linear-gradient(135deg,#0050c8,#1e90ff)', color: '#fff', borderRadius: 2, px: 2, fontSize: '0.72rem', textTransform: 'none' }}>Submit</Button>
                }
            </Box>
        </Box>
    );
};

const SubjectSection = ({ subject, assignments, submissions, onUpload }) => {
    const [open, setOpen] = useState(true);
    const subjectId = subject._id;
    const subjectAssignments = assignments.filter(a => (a.subject && a.subject._id ? a.subject._id : a.subject) === subjectId);
    const pending = subjectAssignments.filter(a => !submissions[a._id]).length;
    return (
        <Box sx={{ background: theme.card, border: theme.cardBorder, borderRadius: 3, mb: 3, overflow: 'hidden', boxShadow: theme.cardShadow }}>
            <Box onClick={() => setOpen(!open)} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, cursor: 'pointer', background: 'linear-gradient(90deg,rgba(30,144,255,.1),transparent)', borderBottom: open ? '1px solid rgba(30,144,255,.12)' : 'none', '&:hover': { background: 'linear-gradient(90deg,rgba(30,144,255,.18),transparent)' } }}>
                <Box>
                    <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '0.95rem' }}>{subject.subName || subject.subjectName}</Typography>
                    <Typography sx={{ color: theme.textMuted, fontSize: '0.72rem' }}>{subject.subCode} • {subjectAssignments.length} assignments{pending > 0 && ` • ${pending} pending`}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {pending > 0 && <Chip label={pending} size="small" sx={{ bgcolor: '#ffab4022', color: '#ffab40', border: '1px solid #ffab4044', minWidth: 28, height: 22, fontSize: '0.72rem' }} />}
                    {open ? <ExpandLessIcon sx={{ color: theme.accent, fontSize: 20 }} /> : <ExpandMoreIcon sx={{ color: theme.accent, fontSize: 20 }} />}
                </Box>
            </Box>
            <Collapse in={open}>
                <Box sx={{ p: 2 }}>
                    {subjectAssignments.length === 0
                        ? <Typography sx={{ color: theme.textMuted, textAlign: 'center', py: 2, fontSize: '0.82rem' }}>No assignments yet</Typography>
                        : subjectAssignments.map(a => <AssignmentCard key={a._id} assignment={a} submission={submissions[a._id]} onUpload={onUpload} />)
                    }
                </Box>
            </Collapse>
        </Box>
    );
};

const StudentAssignments = () => {
    const { currentUser } = useSelector(s => s.user);
    const { subjectsList } = useSelector(s => s.sclass);
    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [uploadDialog, setUploadDialog] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [alert, setAlert] = useState(null);
    const classID = currentUser && currentUser.sclassName ? currentUser.sclassName._id : (currentUser && currentUser.classId ? currentUser.classId._id : null);

    const loadAssignments = async (pageNum, append = false) => {
        if (!classID) { setLoading(false); return; }
        try {
            const res = await axiosInstance.get(`/AssignmentsByClass/${classID}?page=${pageNum}&limit=10`);
            const data = res.data;
            const list = Array.isArray(data) ? data : (data.assignments || []);
            const more = Array.isArray(data) ? false : page < (data.totalPages || 1);
            setAssignments(prev => append ? [...prev, ...list] : list);
            setHasMore(more);
        } catch (_) {}
    };

    useEffect(() => {
        if (!classID) { setLoading(false); return; }
        Promise.all([
            loadAssignments(1),
            axiosInstance.get(`/StudentSubmissions/${currentUser._id}`).catch(() => ({ data: [] }))
        ]).then(([, subRes]) => {
            const map = {};
            (subRes.data || []).forEach(s => {
                map[s.assignmentId?._id || s.assignmentId] = s;
            });
            setSubmissions(map);
        }).finally(() => setLoading(false));
    }, [classID, currentUser._id]);

    const handleLoadMore = async () => {
        setLoadingMore(true);
        const next = page + 1;
        await loadAssignments(next, true);
        setPage(next);
        setLoadingMore(false);
    };

    const handleUploadOpen = (assignment) => { setSelectedAssignment(assignment); setFile(null); setUploadProgress(0); setUploadDialog(true); };

    const handleSubmit = async function() {
        if (!file) return;
        setUploading(true);
        var formData = new FormData();
        var fileList = file instanceof FileList ? Array.from(file) : [file];
        fileList.forEach(function(f) { formData.append('files', f); });
        formData.append('studentId', currentUser._id);
        formData.append('assignmentId', selectedAssignment._id);
        formData.append('school', currentUser.school ? currentUser.school._id || currentUser.school : currentUser.schoolId);
        try {
            var res = await axiosInstance.post('/SubmitAssignment', formData, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress: function(e) { setUploadProgress(Math.round((e.loaded * 100) / e.total)); } });
            setSubmissions(function(prev) { var n = Object.assign({}, prev); n[selectedAssignment._id] = res.data; return n; });
            setAlert({ type: 'success', msg: 'Submitted successfully!' });
            setUploadDialog(false);
        } catch(e) {
            setAlert({ type: 'error', msg: e.response && e.response.data ? e.response.data.message : 'Upload failed' });
        } finally { setUploading(false); }
    };

    if (loading) return React.createElement(Box, { sx: { minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(CircularProgress, { sx: { color: theme.accent } }));

    var totalPending = assignments.filter(function(a) { return !submissions[a._id]; }).length;

    return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Typography sx={{ color: theme.text, fontSize: '1.4rem', fontWeight: 700 }}>Assignments</Typography>
                <Typography sx={{ color: theme.textMuted, fontSize: '0.82rem' }}>{assignments.length} total - {totalPending} pending</Typography>
            </Box>
            {alert && <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>{alert.msg}</Alert>}
            {!subjectsList || subjectsList.length === 0
                ? <Box sx={{ background: theme.card, border: theme.cardBorder, borderRadius: 3, p: 4, textAlign: 'center' }}><Typography sx={{ color: theme.textMuted }}>No subjects enrolled</Typography></Box>
                : subjectsList.map(function(subject) { return <SubjectSection key={subject._id} subject={subject} assignments={assignments} submissions={submissions} onUpload={handleUploadOpen} />; })
            }
            {hasMore && (
                <Box sx={{ textAlign: 'center', mt: 1, mb: 2 }}>
                    <Button onClick={handleLoadMore} disabled={loadingMore}
                        sx={{ color: theme.accent, borderColor: `${theme.accent}44`, border: '1px solid', borderRadius: 2, px: 3, textTransform: 'none', fontSize: '0.82rem' }}>
                        {loadingMore ? <CircularProgress size={16} sx={{ color: theme.accent }} /> : 'Load more assignments'}
                    </Button>
                </Box>
            )}
            <Dialog open={uploadDialog} onClose={() => { if (!uploading) setUploadDialog(false); }} PaperProps={{ sx: { background: '#0a1628', border: theme.cardBorder, borderRadius: 3, minWidth: 380 } }}>
                <DialogTitle sx={{ color: theme.text, borderBottom: '1px solid rgba(30,144,255,.12)', pb: 1.5 }}>
                    Submit Assignment
                    {selectedAssignment && <Typography sx={{ color: theme.accent, fontSize: '0.78rem', mt: 0.3 }}>{selectedAssignment.title}</Typography>}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Box sx={{ border: '2px dashed ' + (file ? theme.accent : 'rgba(30,144,255,.25)'), borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer' }} onClick={() => document.getElementById('file-input').click()}>
                        <UploadFileIcon sx={{ color: theme.accent, fontSize: 36, mb: 1 }} />
                        <Typography sx={{ color: file ? theme.text : theme.textMuted, fontSize: '0.88rem' }}>
                            {file
                                ? (file instanceof FileList
                                    ? `${file.length} file${file.length > 1 ? 's' : ''} selected`
                                    : file.name)
                                : 'Click to select files (up to 5)'}
                        </Typography>
                        <Typography sx={{ color: theme.textMuted, fontSize: '0.7rem', mt: 0.5 }}>PDF, PPT, PPTX, DOC, DOCX, JPG, PNG - max 20MB each</Typography>
                        <input id="file-input" type="file" accept={ALLOWED} multiple hidden onChange={function(e) { setFile(e.target.files); }} />
                    </Box>
                    {uploading && <Box sx={{ mt: 2 }}><LinearProgress variant="determinate" value={uploadProgress} sx={{ height: 5, borderRadius: 3 }} /><Typography sx={{ color: theme.textMuted, fontSize: '0.72rem', mt: 0.5, textAlign: 'center' }}>{uploadProgress}%</Typography></Box>}
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(30,144,255,.12)' }}>
                    <Button onClick={() => setUploadDialog(false)} disabled={uploading} sx={{ color: theme.textMuted, textTransform: 'none' }}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!file || uploading} sx={{ background: 'linear-gradient(135deg,#0050c8,#1e90ff)', color: '#fff', borderRadius: 2, px: 3, textTransform: 'none' }}>{uploading ? 'Uploading...' : 'Submit'}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default StudentAssignments;
