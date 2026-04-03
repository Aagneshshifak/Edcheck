import { Box, Typography } from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import SeeNotice from '../../components/SeeNotice';
import { theme } from '../../theme/studentTheme';

const StudentNotices = () => (
    <Box sx={{ minHeight: '100vh', background: theme.bg, p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <CampaignIcon sx={{ color: theme.accent, fontSize: '1.6rem' }} />
            <Typography sx={{ color: theme.text, fontWeight: 800, fontSize: '1.4rem' }}>
                School Notices
            </Typography>
        </Box>
        <SeeNotice />
    </Box>
);

export default StudentNotices;
