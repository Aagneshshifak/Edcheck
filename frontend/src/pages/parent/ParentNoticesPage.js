import { Box, Typography } from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import SeeNotice from '../../components/SeeNotice';

const ParentNoticesPage = () => (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <CampaignIcon sx={{ fontSize: '1.8rem' }} />
            <Typography sx={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                Notices
            </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: '0.88rem', mb: 3, ml: 0.5 }}>
            School announcements and updates
        </Typography>
        <SeeNotice />
    </Box>
);

export default ParentNoticesPage;
