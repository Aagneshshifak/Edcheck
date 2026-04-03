import { Box, Typography } from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import SeeNotice from '../../components/SeeNotice';

const ParentNoticesPage = () => (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <CampaignIcon sx={{ color: '#0ea5e9', fontSize: '1.8rem' }} />
            <Typography sx={{ color: '#f1f5f9', fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Notices
            </Typography>
        </Box>
        <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.88rem', mb: 3, ml: 0.5 }}>
            School announcements and updates
        </Typography>
        <SeeNotice />
    </Box>
);

export default ParentNoticesPage;
