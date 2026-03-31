import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { getSubjectList } from '../../redux/sclassRelated/sclassHandle';
import { BottomNavigation, BottomNavigationAction, Container, Paper, Table, TableBody, TableHead, Typography } from '@mui/material';
import { getUserDetails } from '../../redux/userRelated/userHandle';
import CustomBarChart from '../../components/CustomBarChart'

import InsertChartIcon from '@mui/icons-material/InsertChart';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import TableChartIcon from '@mui/icons-material/TableChart';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { StyledTableCell, StyledTableRow } from '../../components/styles';

const StudentSubjects = () => {

    const dispatch = useDispatch();
    const { subjectsList, sclassDetails } = useSelector((state) => state.sclass);
    const { userDetails, currentUser, loading, response, error } = useSelector((state) => state.user);

    useEffect(() => {
        dispatch(getUserDetails(currentUser._id, "Student"));
    }, [dispatch, currentUser._id])

    if (response) { console.log(response) }
    else if (error) { console.log(error) }

    const [subjectMarks, setSubjectMarks] = useState([]);
    const [selectedSection, setSelectedSection] = useState('table');

    useEffect(() => {
        if (userDetails) {
            setSubjectMarks(userDetails.examResult || []);
        }
    }, [userDetails])

    useEffect(() => {
        if (subjectMarks.length === 0) {
            dispatch(getSubjectList(currentUser.sclassName._id, "ClassSubjects"));
        }
    }, [subjectMarks, dispatch, currentUser.sclassName._id]);

    const handleSectionChange = (event, newSection) => {
        setSelectedSection(newSection);
    };

    const renderTableSection = () => {
        return (
            <>
                <Typography variant="h5" align="center" gutterBottom sx={{ color: '#e8f4fd', pt: 3, fontWeight: 700, letterSpacing: 0.5 }}>
                    Subject Marks
                </Typography>
                <Table sx={{ '& .MuiTableCell-root': { borderColor: 'rgba(30,144,255,0.12)' } }}>
                    <TableHead>
                        <StyledTableRow>
                            <StyledTableCell sx={{ background: 'linear-gradient(90deg,#0d1b2a,#112240)', color: '#1e90ff', fontWeight: 700 }}>Subject</StyledTableCell>
                            <StyledTableCell sx={{ background: 'linear-gradient(90deg,#0d1b2a,#112240)', color: '#1e90ff', fontWeight: 700 }}>Marks</StyledTableCell>
                        </StyledTableRow>
                    </TableHead>
                    <TableBody>
                        {subjectMarks.map((result, index) => {
                            if (!result.subName || !result.marksObtained) return null;
                            return (
                                <StyledTableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'rgba(13,27,42,0.8)' }, '&:nth-of-type(even)': { bgcolor: 'rgba(10,22,40,0.6)' }, '&:hover': { bgcolor: 'rgba(30,144,255,0.08) !important' } }}>
                                    <StyledTableCell sx={{ color: '#e8f4fd' }}>{result.subName.subName}</StyledTableCell>
                                    <StyledTableCell sx={{ color: result.marksObtained >= 75 ? '#00e676' : result.marksObtained >= 50 ? '#ffab40' : '#ff5252', fontWeight: 700 }}>{result.marksObtained}</StyledTableCell>
                                </StyledTableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </>
        );
    };

    const renderChartSection = () => {
        return <CustomBarChart chartData={subjectMarks} dataKey="marksObtained" />;
    };

    const renderClassDetailsSection = () => {
        return (
            <Container sx={{ pt: 3 }}>
                <Typography variant="h5" align="center" gutterBottom sx={{ color: '#e8f4fd', fontWeight: 700 }}>
                    Class Details
                </Typography>
                <Typography variant="h6" gutterBottom sx={{ color: 'rgba(232,244,253,0.7)', textAlign: 'center', mb: 3 }}>
                    Class: {sclassDetails && sclassDetails.sclassName}
                </Typography>
                {subjectsList && subjectsList.map((subject, index) => (
                    <div key={index} style={{ background: 'linear-gradient(145deg,#0d1b2a,#112240)', border: '1px solid rgba(30,144,255,0.18)', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                        <Typography variant="subtitle1" sx={{ color: '#e8f4fd' }}>
                            {subject.subName} <span style={{ color: '#1e90ff', fontSize: '0.8rem' }}>({subject.subCode})</span>
                        </Typography>
                    </div>
                ))}
            </Container>
        );
    };

    return (
        <>
            {loading ? (
                <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e90ff' }}>Loading...</div>
            ) : (
                <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#0a0a0f 0%,#0d1b2a 50%,#0a0a0f 100%)', paddingBottom: 80 }}>
                    {subjectMarks && Array.isArray(subjectMarks) && subjectMarks.length > 0
                        ?
                        (<>
                            {selectedSection === 'table' && renderTableSection()}
                            {selectedSection === 'chart' && renderChartSection()}

            <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(90deg, #050d18, #0a1628)', borderTop: '1px solid rgba(30,144,255,0.15)' }} elevation={3}>
                                <BottomNavigation value={selectedSection} onChange={handleSectionChange} showLabels sx={{ background: 'transparent' }}>
                                    <BottomNavigationAction
                                        label="Table"
                                        value="table"
                                        icon={selectedSection === 'table' ? <TableChartIcon /> : <TableChartOutlinedIcon />}
                                        sx={{ color: selectedSection === 'table' ? '#1e90ff' : 'rgba(232,244,253,0.5)', '&.Mui-selected': { color: '#1e90ff' } }}
                                    />
                                    <BottomNavigationAction
                                        label="Chart"
                                        value="chart"
                                        icon={selectedSection === 'chart' ? <InsertChartIcon /> : <InsertChartOutlinedIcon />}
                                        sx={{ color: selectedSection === 'chart' ? '#1e90ff' : 'rgba(232,244,253,0.5)', '&.Mui-selected': { color: '#1e90ff' } }}
                                    />
                                </BottomNavigation>
                            </Paper>
                        </>)
                        :
                        (<>
                            {renderClassDetailsSection()}
                        </>)
                    }
                </div>
            )}
        </>
    );
};

export default StudentSubjects;