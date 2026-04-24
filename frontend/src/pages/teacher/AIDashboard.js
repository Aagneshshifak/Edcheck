import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Container, Box, Typography, Paper, Tabs, Tab } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import NoteSuggestionsPanel from '../../components/ai/NoteSuggestionsPanel';
import WeakTopicsPanel from '../../components/ai/WeakTopicsPanel';
import QuestionGeneratorPanel from '../../components/ai/QuestionGeneratorPanel';

const AIDashboard = () => {
    const [tab, setTab] = useState(0);
    const currentUser = useSelector(state => state.user.currentUser);

    const teachSubjects = currentUser?.teachSubjects || [];
    const classId = currentUser?.teachSclass?._id || '';

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <AutoAwesomeIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>AI Teaching Assistant</Typography>
            </Box>

            <Paper sx={{ mb: 3 }}>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab label="Note Suggestions" />
                    <Tab label="Weak Topics & Clarification" />
                    <Tab label="Generate Questions" />
                </Tabs>
            </Paper>

            <Box>
                {tab === 0 && <NoteSuggestionsPanel teachSubjects={teachSubjects} />}
                {tab === 1 && <WeakTopicsPanel teachSubjects={teachSubjects} classId={classId} />}
                {tab === 2 && <QuestionGeneratorPanel teachSubjects={teachSubjects} />}
            </Box>
        </Container>
    );
};

export default AIDashboard;
