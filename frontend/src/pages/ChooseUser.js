import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Backdrop, CircularProgress } from '@mui/material';
import { AccountCircle, School, Group, FamilyRestroom, ArrowForwardIos } from '@mui/icons-material';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../redux/userRelated/userHandle';
import Popup from '../components/Popup';

const ROLES = [
    { role: 'Admin',   icon: <AccountCircle sx={{ fontSize: 28 }} />,    desc: 'Manage dashboard, students, teachers and app data.' },
    { role: 'Student', icon: <School sx={{ fontSize: 28 }} />,           desc: 'Access courses, assignments and attendance.' },
    { role: 'Teacher', icon: <Group sx={{ fontSize: 28 }} />,            desc: 'Create tests, assignments and track progress.' },
    { role: 'Parent',  icon: <FamilyRestroom sx={{ fontSize: 28 }} />,   desc: "Monitor your child's progress and attendance." },
];

const ChooseUser = ({ visitor }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const password = 'zxc';

    const { status, currentUser, currentRole } = useSelector(state => state.user);
    const [loader,     setLoader]     = useState(false);
    const [showPopup,  setShowPopup]  = useState(false);
    const [message,    setMessage]    = useState('');

    const navigateHandler = (user) => {
        if (user === 'Admin') {
            if (visitor === 'guest') { setLoader(true); dispatch(loginUser({ email: 'yogendra@12', password }, user)); }
            else navigate('/Adminlogin');
        } else if (user === 'Student') {
            if (visitor === 'guest') { setLoader(true); dispatch(loginUser({ rollNum: '1', studentName: 'Dipesh Awasthi', password }, user)); }
            else navigate('/Studentlogin');
        } else if (user === 'Teacher') {
            if (visitor === 'guest') { setLoader(true); dispatch(loginUser({ email: 'tony@12', password }, user)); }
            else navigate('/Teacherlogin');
        } else if (user === 'Parent') {
            if (visitor === 'guest') { setMessage('No guest account for Parent. Please register.'); setShowPopup(true); }
            else navigate('/Parentlogin');
        }
    };

    useEffect(() => {
        if (status === 'success' || currentUser !== null) {
            if (currentRole === 'Admin')        navigate('/Admin/dashboard');
            else if (currentRole === 'Student') navigate('/Student/dashboard');
            else if (currentRole === 'Teacher') navigate('/Teacher/dashboard');
            else if (currentRole === 'Parent')  navigate('/Parent/dashboard');
        } else if (status === 'error') {
            setLoader(false);
            setMessage('Network Error');
            setShowPopup(true);
        }
    }, [status, currentRole, navigate, currentUser]);

    return (
        <PageWrap>
            <Blob style={{ top: '-120px', left: '-120px', width: 400, height: 400, opacity: 0.18 }} />
            <Blob style={{ bottom: '-100px', right: '-100px', width: 350, height: 350, opacity: 0.12 }} />

            <Inner>
                <Header>
                    <Logo>Edcheck</Logo>
                    <Sub>Choose your role to continue</Sub>
                </Header>

                <CardList>
                    {ROLES.map(({ role, icon, desc }) => (
                        <RoleCard key={role} onClick={() => navigateHandler(role)}>
                            <CardLeft>
                                <IconCircle>{icon}</IconCircle>
                                <CardInfo>
                                    <RoleTitle>{role}</RoleTitle>
                                    <RoleDesc>{desc}</RoleDesc>
                                </CardInfo>
                            </CardLeft>
                            <Arrow><ArrowForwardIos sx={{ fontSize: 14, opacity: 0.5 }} /></Arrow>
                        </RoleCard>
                    ))}
                </CardList>
            </Inner>

            <Backdrop sx={{ color: '#fff', zIndex: 9999 }} open={loader}>
                <CircularProgress color="inherit" />
            </Backdrop>
            <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
        </PageWrap>
    );
};

export default ChooseUser;

/* ── Styles ──────────────────────────────────────────────────────────────── */

const PageWrap = styled.div`
    min-height: 100vh;
    background: #0a0a0a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    position: relative;
    overflow: hidden;
`;

const Blob = styled.div`
    position: absolute;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.25), transparent 70%);
    pointer-events: none;
`;

/* No outer box — just a centered content wrapper */
const Inner = styled.div`
    width: 100%;
    max-width: 480px;
    position: relative;
    z-index: 1;
`;

const Header = styled.div`
    text-align: center;
    margin-bottom: 2rem;
`;

const Logo = styled.h1`
    color: #ffffff;
    font-size: 2rem;
    font-weight: 800;
    margin: 0 0 0.3rem;
    letter-spacing: -0.5px;
`;

const Sub = styled.p`
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
    margin: 0;
`;

const CardList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
`;

/* Individual glass row card */
const RoleCard = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.07);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 1rem 1.2rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);

    &:hover {
        background: rgba(255, 255, 255, 0.13);
        border-color: rgba(255, 255, 255, 0.25);
        transform: translateX(4px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
    }
`;

const CardLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
`;

const IconCircle = styled.div`
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    flex-shrink: 0;
`;

const CardInfo = styled.div`
    display: flex;
    flex-direction: column;
`;

const RoleTitle = styled.span`
    color: #ffffff;
    font-size: 0.95rem;
    font-weight: 700;
    line-height: 1.3;
`;

const RoleDesc = styled.span`
    color: rgba(255, 255, 255, 0.45);
    font-size: 0.75rem;
    line-height: 1.4;
    margin-top: 2px;
`;

const Arrow = styled.div`
    color: #ffffff;
    flex-shrink: 0;
`;
