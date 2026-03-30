import { useSelector } from 'react-redux';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { FamilyRestroom, School } from '@mui/icons-material';

const ParentHomePage = () => {
    const { currentUser } = useSelector(state => state.user);

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 3, color: '#2c2143' }}>
                Welcome, {currentUser?.name}
            </Typography>
            <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={4}>
                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                        <FamilyRestroom sx={{ fontSize: 48, color: '#7f56da' }} />
                        <Typography variant="h6" sx={{ mt: 1 }}>
                            My Children
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {currentUser?.children?.length || 0} registered
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                        <School sx={{ fontSize: 48, color: '#7f56da' }} />
                        <Typography variant="h6" sx={{ mt: 1 }}>
                            School
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {currentUser?.school?.schoolName || 'N/A'}
                        </Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ParentHomePage;
