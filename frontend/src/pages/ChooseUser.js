import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Backdrop,
  CircularProgress,
} from '@mui/material';
import { AccountCircle, School, Group, FamilyRestroom } from '@mui/icons-material';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../redux/userRelated/userHandle';
import Popup from '../components/Popup';

const ChooseUser = ({ visitor }) => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const password = "zxc"

  const { status, currentUser, currentRole } = useSelector(state => state.user);;

  const [loader, setLoader] = useState(false)
  const [showPopup, setShowPopup] = useState(false);
  const [message, setMessage] = useState("");

  const navigateHandler = (user) => {
    if (user === "Admin") {
      if (visitor === "guest") {
        const email = "yogendra@12"
        const fields = { email, password }
        setLoader(true)
        dispatch(loginUser(fields, user))
      }
      else {
        navigate('/Adminlogin');
      }
    }

    else if (user === "Student") {
      if (visitor === "guest") {
        const rollNum = "1"
        const studentName = "Dipesh Awasthi"
        const fields = { rollNum, studentName, password }
        setLoader(true)
        dispatch(loginUser(fields, user))
      }
      else {
        navigate('/Studentlogin');
      }
    }

    else if (user === "Teacher") {
      if (visitor === "guest") {
        const email = "tony@12"
        const fields = { email, password }
        setLoader(true)
        dispatch(loginUser(fields, user))
      }
      else {
        navigate('/Teacherlogin');
      }
    }
    else if (user === "Parent") {
      if (visitor === "guest") {
        setMessage("No guest account for Parent. Please register.")
        setShowPopup(true)
      } else {
        navigate('/Parentlogin');
      }
    }
  }

  useEffect(() => {
    if (status === 'success' || currentUser !== null) {
      if (currentRole === 'Admin')        navigate('/Admin/dashboard');
      else if (currentRole === 'Student') navigate('/Student/dashboard');
      else if (currentRole === 'Teacher') navigate('/Teacher/dashboard');
      else if (currentRole === 'Parent')  navigate('/Parent/dashboard');
    }
    else if (status === 'error') {
      setLoader(false)
      setMessage("Network Error")
      setShowPopup(true)
    }
  }, [status, currentRole, navigate, currentUser]);

  return (
    <StyledContainer>
      <HeaderText>Edcheck</HeaderText>
      <SubText>Choose your role to continue</SubText>
      <CardsRow>
        {[
          { role: "Admin",   icon: <AccountCircle sx={{ fontSize: 48 }} />, desc: "Login as an administrator to access the dashboard to manage app data." },
          { role: "Student", icon: <School sx={{ fontSize: 48 }} />,        desc: "Login as a student to explore course materials and assignments." },
          { role: "Teacher", icon: <Group sx={{ fontSize: 48 }} />,         desc: "Login as a teacher to create courses, assignments, and track student progress." },
          { role: "Parent",  icon: <FamilyRestroom sx={{ fontSize: 48 }} />,desc: "Login as a parent to monitor your child's progress, attendance, and performance." },
        ].map(({ role, icon, desc }) => (
          <StyledCard key={role} onClick={() => navigateHandler(role)}>
            <IconWrap>{icon}</IconWrap>
            <CardTitle>{role}</CardTitle>
            <CardDesc>{desc}</CardDesc>
          </StyledCard>
        ))}
      </CardsRow>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loader}
      >
        <CircularProgress color="inherit" />
        Please Wait
      </Backdrop>
      <Popup message={message} setShowPopup={setShowPopup} showPopup={showPopup} />
    </StyledContainer>
  );
};

export default ChooseUser;

const StyledContainer = styled.div`
  background: #ffffff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
`;

const HeaderText = styled.h1`
  color: #111111;
  font-size: clamp(1.5rem, 3vw, 2.4rem);
  font-weight: 800;
  margin-bottom: 0.4rem;
  text-align: center;
  letter-spacing: -0.5px;
`;

const SubText = styled.p`
  color: #555555;
  font-size: 1rem;
  margin-bottom: 2.5rem;
  text-align: center;
`;

const CardsRow = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;
  align-items: stretch;
  width: 100%;
  max-width: 1100px;
`;

const StyledCard = styled.div`
  background: #111111;
  color: #ffffff;
  border-radius: 60px;
  padding: 2.5rem 1.8rem;
  flex: 1 1 200px;
  max-width: 240px;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);

  &:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
    background: #222222;
  }
`;

const IconWrap = styled.div`
  margin-bottom: 1rem;
  color: #ffffff;
`;

const CardTitle = styled.h2`
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 0.6rem;
  color: #ffffff;
`;

const CardDesc = styled.p`
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.5;
`;