import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Grid, Box, Typography, Paper, Checkbox, FormControlLabel, TextField, CssBaseline, IconButton, InputAdornment, CircularProgress, Backdrop } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import bgpic from "../assets/designlogin.jpg"
import { LightPurpleButton } from '../components/buttonStyles';
import styled from 'styled-components';
import { loginUser } from '../redux/userRelated/userHandle';
import Popup from '../components/Popup';

const defaultTheme = createTheme();

// Shared clean field styles — white inputs on black background
const fieldSx = {
    '& .MuiOutlinedInput-root': {
        color: '#ffffff',
        borderRadius: '10px',
        backgroundColor: 'rgba(255,255,255,0.08)',
        '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
        '&.Mui-focused fieldset': { borderColor: '#ffffff' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#ffffff' },
    '& .MuiInputBase-input': { color: '#ffffff' },
    '& .MuiFormHelperText-root': { color: '#f87171' },
};

const LoginPage = ({ role }) => {

    const dispatch = useDispatch()
    const navigate = useNavigate()

    const { status, currentUser, response, error, currentRole } = useSelector(state => state.user);;

    const [toggle, setToggle] = useState(false)
    const [guestLoader, setGuestLoader] = useState(false)
    const [loader, setLoader] = useState(false)
    const [showPopup, setShowPopup] = useState(false);
    const [message, setMessage] = useState("");

    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);
    const [rollNumberError, setRollNumberError] = useState(false);
    const [studentNameError, setStudentNameError] = useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();

        if (role === "Student") {
            const rollNum = event.target.rollNumber.value;
            const studentName = event.target.studentName.value;
            const password = event.target.password.value;

            if (!rollNum || !studentName || !password) {
                if (!rollNum) setRollNumberError(true);
                if (!studentName) setStudentNameError(true);
                if (!password) setPasswordError(true);
                return;
            }
            const fields = { rollNum, studentName, password }
            setLoader(true)
            dispatch(loginUser(fields, role))
        }

        else {
            const email = event.target.email.value;
            const password = event.target.password.value;

            if (!email || !password) {
                if (!email) setEmailError(true);
                if (!password) setPasswordError(true);
                return;
            }

            const fields = { email, password }
            setLoader(true)
            dispatch(loginUser(fields, role))
        }
    };

    const handleInputChange = (event) => {
        const { name } = event.target;
        if (name === 'email') setEmailError(false);
        if (name === 'password') setPasswordError(false);
        if (name === 'rollNumber') setRollNumberError(false);
        if (name === 'studentName') setStudentNameError(false);
    };

    const guestModeHandler = () => {
        const password = "zxc"

        if (role === "Admin") {
            const email = "yogendra@12"
            const fields = { email, password }
            setGuestLoader(true)
            dispatch(loginUser(fields, role))
        }
        else if (role === "Student") {
            const rollNum = "1"
            const studentName = "Dipesh Awasthi"
            const fields = { rollNum, studentName, password }
            setGuestLoader(true)
            dispatch(loginUser(fields, role))
        }
        else if (role === "Teacher") {
            const email = "tony@12"
            const fields = { email, password }
            setGuestLoader(true)
            dispatch(loginUser(fields, role))
        }
        else if (role === "Parent") {
            setMessage("No guest account for Parent.")
            setShowPopup(true)
        }
    }

    useEffect(() => {
        if (status === 'success' || currentUser !== null) {
            if (currentRole === 'Admin')        navigate('/Admin/dashboard');
            else if (currentRole === 'Student') navigate('/Student/dashboard');
            else if (currentRole === 'Teacher') navigate('/Teacher/dashboard');
            else if (currentRole === 'Parent')  navigate('/Parent/mychildren');
        }
        else if (status === 'failed') {
            setMessage(response)
            setShowPopup(true)
            setLoader(false)
        }
        else if (status === 'error') {
            setMessage("Network Error")
            setShowPopup(true)
            setLoader(false)
            setGuestLoader(false)
        }
    }, [status, currentRole, navigate, error, response, currentUser]);

    return (
        <ThemeProvider theme={defaultTheme}>
            <Grid container component="main" sx={{ height: '100vh', background: '#ffffff' }}>
                <CssBaseline />

                {/* Left panel — black card */}
                <Grid item xs={12} sm={8} md={5} component={Paper} elevation={0} square
                    sx={{
                        background: '#111111',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: { md: '0 40px 40px 0' },
                    }}>
                    <Box sx={{ my: 6, mx: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 400 }}>
                        {/* Logo / brand */}
                        <Box sx={{
                            width: 52, height: 52, borderRadius: '50%', mb: 2,
                            background: '#ffffff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Typography sx={{ color: '#111111', fontWeight: 800, fontSize: '1.3rem' }}>S</Typography>
                        </Box>

                        <Typography variant="h5" sx={{ mb: 0.5, color: '#ffffff', fontWeight: 700 }}>
                            {role} Login
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', mb: 3 }}>
                            Welcome back — please enter your details
                        </Typography>

                        <Box component="form" noValidate onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                            {role === "Student" ? (
                                <>
                                    <TextField
                                        margin="normal" required fullWidth
                                        id="rollNumber" label="Roll Number" name="rollNumber"
                                        autoComplete="off" type="number" autoFocus
                                        error={rollNumberError}
                                        helperText={rollNumberError && 'Roll Number is required'}
                                        onChange={handleInputChange}
                                        sx={fieldSx}
                                    />
                                    <TextField
                                        margin="normal" required fullWidth
                                        id="studentName" label="Full Name" name="studentName"
                                        autoComplete="name"
                                        error={studentNameError}
                                        helperText={studentNameError && 'Name is required'}
                                        onChange={handleInputChange}
                                        sx={fieldSx}
                                    />
                                </>
                            ) : (
                                <TextField
                                    margin="normal" required fullWidth
                                    id="email" label="Email" name="email"
                                    autoComplete="email" autoFocus
                                    error={emailError}
                                    helperText={emailError && 'Email is required'}
                                    onChange={handleInputChange}
                                    sx={fieldSx}
                                />
                            )}
                            <TextField
                                margin="normal" required fullWidth
                                name="password" label="Password"
                                type={toggle ? 'text' : 'password'}
                                id="password" autoComplete="current-password"
                                error={passwordError}
                                helperText={passwordError && 'Password is required'}
                                onChange={handleInputChange}
                                sx={fieldSx}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setToggle(!toggle)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                                {toggle ? <Visibility /> : <VisibilityOff />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Grid container sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                <FormControlLabel
                                    control={<Checkbox value="remember" sx={{ color: '#ffffff', '&.Mui-checked': { color: '#ffffff' } }} />}
                                    label={<Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem' }}>Remember me</Typography>}
                                />
                                <StyledLink href="#" sx={{ mt: 1.2, fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>
                                    Forgot password?
                                </StyledLink>
                            </Grid>

                            <Button type="submit" fullWidth variant="contained"
                                sx={{
                                    mt: 3, py: 1.3, borderRadius: '10px', fontWeight: 700,
                                    background: '#ffffff',
                                    color: '#111111', textTransform: 'none', fontSize: '0.95rem',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                    '&:hover': { background: '#f0f0f0', boxShadow: '0 6px 20px rgba(0,0,0,0.2)' },
                                    transition: 'all 0.2s ease',
                                }}>
                                {loader ? <CircularProgress size={22} sx={{ color: '#111111' }} /> : 'Sign In'}
                            </Button>

                            <Button fullWidth onClick={guestModeHandler} variant="outlined"
                                sx={{
                                    mt: 1.5, mb: 3, py: 1.2, borderRadius: '10px',
                                    color: '#ffffff', borderColor: 'rgba(255,255,255,0.35)',
                                    textTransform: 'none', fontWeight: 600,
                                    '&:hover': { borderColor: '#ffffff', background: 'rgba(255,255,255,0.08)' },
                                    transition: 'all 0.2s ease',
                                }}>
                                {guestLoader ? <CircularProgress size={20} sx={{ color: '#ffffff' }} /> : 'Continue as Guest'}
                            </Button>

                            {role === "Admin" && (
                                <Grid container justifyContent="center">
                                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.83rem' }}>
                                        Don't have an account?{' '}
                                        <StyledLink to="/Adminregister" style={{ color: '#ffffff', marginLeft: 4 }}>
                                            Sign up
                                        </StyledLink>
                                    </Typography>
                                </Grid>
                            )}
                        </Box>
                    </Box>
                </Grid>

                {/* Right panel — white with branding */}
                <Grid item xs={false} sm={4} md={7} sx={{
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Decorative circles */}
                    <Box sx={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: 'rgba(0,0,0,0.04)', top: -100, right: -100 }} />
                    <Box sx={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'rgba(0,0,0,0.03)', bottom: 40, left: -70 }} />
                    <Box sx={{ textAlign: 'center', zIndex: 1, px: 4 }}>
                        <Typography sx={{ color: '#111111', fontSize: '3rem', fontWeight: 900, lineHeight: 1.1, mb: 2, letterSpacing: '-1px' }}>
                            Edcheck
                        </Typography>
                        <Typography sx={{ color: '#555555', fontSize: '0.95rem', maxWidth: 360, mx: 'auto', lineHeight: 1.7 }}>
                            Streamline attendance, assessments, assignments, and communication — all in one place.
                        </Typography>
                    </Box>
                </Grid>
            </Grid>

            <Backdrop sx={{ color: '#fff', zIndex: (t) => t.zIndex.drawer + 1 }} open={guestLoader}>
                <CircularProgress color="inherit" />
            </Backdrop>
            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </ThemeProvider>
    );
}

export default LoginPage

const StyledLink = styled(Link)`
  text-decoration: none;
  color: rgba(255, 255, 255, 0.7);
`;
