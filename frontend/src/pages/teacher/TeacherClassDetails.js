import { useEffect } from "react";
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom'
import { getClassStudents } from "../../redux/sclassRelated/sclassHandle";
import {
    Paper, Box, Typography, Button, Chip, CircularProgress,
    Table, TableBody, TableCell, TableHead, TableRow, Avatar,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';

const TeacherClassDetails = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { sclassStudents, loading, error, getresponse } = useSelector((state) => state.sclass);
    const { currentUser } = useSelector((state) => state.user);

    const classID = currentUser.teachSclass?._id
        || currentUser.teachClasses?.[0]?._id
        || currentUser.teachClasses?.[0];
    const subjectID = currentUser.teachSubject?._id
        || currentUser.teachSubjects?.[0]?._id
        || currentUser.teachSubjects?.[0];

    useEffect(() => {
        if (classID) dispatch(getClassStudents(classID));
    }, [dispatch, classID]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <PeopleAltIcon sx={{ fontSize: 28 }} />
                    <Typography variant="h5" fontWeight={700}>
                        Class Details
                    </Typography>
                </Box>
                {Array.isArray(sclassStudents) && (
                    <Chip
                        label={`${sclassStudents.length} Student${sclassStudents.length !== 1 ? 's' : ''}`}
                        variant="outlined"
                        size="small"
                    />
                )}
            </Box>

            {getresponse ? (
                <Paper sx={{ p: 6, textAlign: 'center' }}>
                    <PeopleAltIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                    <Typography color="text.secondary">No students found in this class.</Typography>
                </Paper>
            ) : (
                <Paper sx={{ overflow: 'hidden' }}>
                    <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            Students List
                        </Typography>
                    </Box>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>Roll Number</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {Array.isArray(sclassStudents) && sclassStudents.map((student) => (
                                <TableRow key={student._id} hover>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem' }}>
                                                {student.name?.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Typography fontWeight={500} fontSize="0.9rem">
                                                {student.name}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={student.rollNum} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<VisibilityIcon />}
                                                onClick={() => navigate(`/Teacher/class/student/${student._id}`)}
                                                sx={{ textTransform: 'none', fontWeight: 600 }}
                                            >
                                                View
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                startIcon={<HowToRegIcon />}
                                                onClick={() => navigate(`/Teacher/class/student/attendance/${student._id}/${subjectID}`)}
                                                sx={{ textTransform: 'none', fontWeight: 600 }}
                                            >
                                                Take Attendance
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<EditNoteIcon />}
                                                onClick={() => navigate(`/Teacher/class/student/marks/${student._id}/${subjectID}`)}
                                                sx={{ textTransform: 'none', fontWeight: 600 }}
                                            >
                                                Marks
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}
        </Box>
    );
};

export default TeacherClassDetails;
