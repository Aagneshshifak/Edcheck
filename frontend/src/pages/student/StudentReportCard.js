import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import ReportCard from '../../components/ReportCard';

const StudentReportCard = () => {
    const { currentUser } = useSelector(s => s.user);
    return (
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0b1120', minHeight: '100vh' }}>
            <ReportCard studentId={currentUser?._id} />
        </Box>
    );
};

export default StudentReportCard;
