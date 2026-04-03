import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
    Box,
    Typography,
    Paper,
    CircularProgress,
    Alert,
} from '@mui/material';
import axiosInstance from '../../utils/axiosInstance';

import { fetchProgress } from '../../redux/progressRelated/progressHandle';
import { generateSubjectColors } from './progressUtils';
import SubjectFilter from './SubjectFilter';
import ProgressLineChart from './ProgressLineChart';
import ProgressBarChart from './ProgressBarChart';
import TrendLegend from './TrendLegend';

const LearningProgressChart = ({ studentId: studentIdProp, viewerRole }) => {
    const dispatch = useDispatch();
    const { id: paramId } = useParams();

    const currentUser = useSelector((state) => state.user.currentUser);
    const progress = useSelector((state) => state.progress);

    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [studentInfo, setStudentInfo] = useState(null);

    // Resolve the target student ID
    const targetStudentId = viewerRole === 'Teacher'
        ? (studentIdProp || paramId)
        : (studentIdProp || currentUser?._id);

    useEffect(() => {
        if (targetStudentId) {
            dispatch(fetchProgress(targetStudentId));
        }
    }, [dispatch, targetStudentId]);

    // Fetch student name + class for teacher view
    useEffect(() => {
        if (viewerRole !== 'Teacher' || !targetStudentId) return;
        axiosInstance
            .get(`/Student/${targetStudentId}`)
            .then((res) => setStudentInfo(res.data))
            .catch(() => setStudentInfo(null));
    }, [viewerRole, targetStudentId]);

    const subjects = progress.data
        ? [...new Set(progress.data.map((item) => item.subjectName))]
        : [];

    const subjectColors = generateSubjectColors(subjects);

    if (progress.loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {progress.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {progress.error}
                </Alert>
            )}

            {viewerRole === 'Teacher' && studentInfo && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h5" fontWeight={700}>
                        {studentInfo.name}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        {studentInfo.sclassName?.sclassName || studentInfo.sclassName || ''}
                    </Typography>
                </Box>
            )}

            <Typography variant="h5" fontWeight={700} mb={3}>
                Learning Progress
            </Typography>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" mb={1}>
                    Filter by Subject
                </Typography>
                <SubjectFilter
                    subjects={subjects}
                    selected={selectedSubjects}
                    onChange={setSelectedSubjects}
                />
            </Paper>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                    Score Over Time
                </Typography>
                <ProgressLineChart data={progress.data} selectedSubjects={selectedSubjects} />
            </Paper>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                    Average Score by Subject
                </Typography>
                <ProgressBarChart data={progress.data} selectedSubjects={selectedSubjects} />
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" mb={1}>
                    Trends
                </Typography>
                <TrendLegend
                    data={progress.data}
                    selectedSubjects={selectedSubjects}
                    subjectColors={subjectColors}
                />
            </Paper>
        </Box>
    );
};

export default LearningProgressChart;
