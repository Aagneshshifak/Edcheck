import React from 'react'
import styled from 'styled-components';
import { Card, CardContent, Typography } from '@mui/material';
import { useSelector } from 'react-redux';

const TeacherProfile = () => {
  const { currentUser, response, error } = useSelector((state) => state.user);

  if (response) { console.log(response) }
  else if (error) { console.log(error) }

  const teachSclass   = currentUser?.teachSclass;
  const teachSubject  = currentUser?.teachSubject;
  const teachSchool   = currentUser?.school;

  // Support both single and multi-subject/class
  const className   = teachSclass?.sclassName || teachSclass?.className
      || currentUser?.teachClasses?.[0]?.sclassName || currentUser?.teachClasses?.[0]?.className || '—';
  const subjectName = teachSubject?.subName || teachSubject?.subjectName
      || currentUser?.teachSubjects?.[0]?.subName || currentUser?.teachSubjects?.[0]?.subjectName || '—';
  const schoolName  = teachSchool?.schoolName || '—';

  return (
    <>
      <ProfileCard>
        <ProfileCardContent>
          <ProfileText>Name: {currentUser?.name}</ProfileText>
          <ProfileText>Email: {currentUser?.email}</ProfileText>
          <ProfileText>Class: {className}</ProfileText>
          <ProfileText>Subject: {subjectName}</ProfileText>
          <ProfileText>School: {schoolName}</ProfileText>
        </ProfileCardContent>
      </ProfileCard>
    </>
  )
}

export default TeacherProfile

const ProfileCard = styled(Card)`
  margin: 20px;
  width: 400px;
  border-radius: 10px;
`;

const ProfileCardContent = styled(CardContent)`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ProfileText = styled(Typography)`
  margin: 10px;
`;