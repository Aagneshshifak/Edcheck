import { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import Popup from '../../components/Popup';
import { BlueButton } from '../../components/buttonStyles';
import { addStuff } from '../../redux/userRelated/userHandle';
import { useDispatch, useSelector } from 'react-redux';

const StudentComplain = () => {
    const [complaint, setComplaint] = useState("");
    const [date, setDate] = useState("");

    const dispatch = useDispatch()

    const { status, currentUser, error } = useSelector(state => state.user);

    const user = currentUser._id
    // handle both populated object and plain string ID
    const school = currentUser.school?._id || currentUser.school || currentUser.schoolId?._id || currentUser.schoolId
    const address = "Complain"

    const [loader, setLoader] = useState(false)
    const [message, setMessage] = useState("");
    const [showPopup, setShowPopup] = useState(false);

    const fields = {
        user,
        date,
        complaint,
        school,
    };

    const submitHandler = (event) => {
        event.preventDefault()
        setLoader(true)
        dispatch(addStuff(fields, address))
    };

    const fieldSx = {
        '& .MuiOutlinedInput-root': {
            color: '#e5e7eb',
            borderRadius: '10px',
            '& fieldset': { borderColor: 'rgba(14,165,233,0.25)' },
            '&:hover fieldset': { borderColor: 'rgba(14,165,233,0.5)' },
            '&.Mui-focused fieldset': { borderColor: '#0ea5e9' },
        },
        '& .MuiInputLabel-root': { color: 'rgba(229,231,235,0.5)' },
        '& .MuiInputLabel-root.Mui-focused': { color: '#0ea5e9' },
        '& input[type="date"]::-webkit-calendar-picker-indicator': { filter: 'invert(1)' },
    };

    useEffect(() => {
        if (status === "added") {
            setLoader(false)
            setShowPopup(true)
            setMessage("Done Successfully")
        }
        else if (error) {
            setLoader(false)
            setShowPopup(true)
            setMessage("Network Error")
        }
    }, [status, error])

    return (
        <>
            <Box sx={{ flex: '1 1 auto', alignItems: 'center', display: 'flex', justifyContent: 'center', minHeight: '100vh', background: '#ffffff' }}>
                <Box sx={{ maxWidth: 550, px: 3, py: '100px', width: '100%' }}>
                    <Stack spacing={1} sx={{ mb: 3 }}>
                        <Typography variant="h4" sx={{ color: '#e5e7eb', fontWeight: 700 }}>Complain</Typography>
                    </Stack>
                    <form onSubmit={submitHandler}>
                        <Stack spacing={3}>
                            <TextField
                                fullWidth label="Select Date" type="date"
                                value={date} onChange={(e) => setDate(e.target.value)} required
                                InputLabelProps={{ shrink: true }}
                                sx={fieldSx}
                            />
                            <TextField
                                fullWidth label="Write your complaint" variant="outlined"
                                value={complaint} onChange={(e) => setComplaint(e.target.value)}
                                required multiline maxRows={4}
                                sx={fieldSx}
                            />
                        </Stack>
                        <BlueButton fullWidth size="large" sx={{ mt: 3, borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
                            variant="contained" type="submit" disabled={loader}>
                            {loader ? <CircularProgress size={24} color="inherit" /> : "Submit"}
                        </BlueButton>
                    </form>
                </Box>
            </Box>
            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </>
    );
};

export default StudentComplain;