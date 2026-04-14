import { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import Popup from '../../components/Popup';
import { BlueButton } from '../../components/buttonStyles';
import { addStuff } from '../../redux/userRelated/userHandle';
import { useDispatch, useSelector } from 'react-redux';

const StudentComplain = () => {
    const [complaint, setComplaint] = useState('');
    const [date, setDate] = useState('');
    const dispatch = useDispatch();
    const { status, currentUser, error } = useSelector(state => state.user);

    const user   = currentUser._id;
    const school = currentUser.school?._id || currentUser.school || currentUser.schoolId?._id || currentUser.schoolId;

    const [loader, setLoader]       = useState(false);
    const [message, setMessage]     = useState('');
    const [showPopup, setShowPopup] = useState(false);

    const submitHandler = (event) => {
        event.preventDefault();
        setLoader(true);
        dispatch(addStuff({ user, date, complaint, school }, 'Complain'));
    };

    useEffect(() => {
        if (status === 'added') {
            setLoader(false);
            setShowPopup(true);
            setMessage('Done Successfully');
        } else if (error) {
            setLoader(false);
            setShowPopup(true);
            setMessage('Network Error');
        }
    }, [status, error]);

    return (
        <>
            <Box sx={{ flex: '1 1 auto', alignItems: 'center', display: 'flex', justifyContent: 'center', minHeight: '100vh', background: '#111111' }}>
                <Box sx={{ maxWidth: 550, px: 3, py: '80px', width: '100%' }}>
                    <Stack spacing={1} sx={{ mb: 3 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>Complain</Typography>
                        <Typography variant="body2" color="text.secondary">Submit a complaint to the school administration</Typography>
                    </Stack>
                    <form onSubmit={submitHandler}>
                        <Stack spacing={3}>
                            <TextField
                                fullWidth label="Select Date" type="date"
                                value={date} onChange={(e) => setDate(e.target.value)} required
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                fullWidth label="Write your complaint" variant="outlined"
                                value={complaint} onChange={(e) => setComplaint(e.target.value)}
                                required multiline maxRows={4}
                            />
                        </Stack>
                        <BlueButton
                            fullWidth size="large"
                            sx={{ mt: 3, textTransform: 'none', fontWeight: 600 }}
                            variant="contained" type="submit" disabled={loader}
                        >
                            {loader ? <CircularProgress size={24} color="inherit" /> : 'Submit'}
                        </BlueButton>
                    </form>
                </Box>
            </Box>
            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </>
    );
};

export default StudentComplain;
