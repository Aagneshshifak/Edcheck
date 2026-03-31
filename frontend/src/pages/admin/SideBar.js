import * as React from "react";
import { Divider, ListItemButton, ListItemIcon, ListItemText, ListSubheader } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import AnnouncementOutlinedIcon from "@mui/icons-material/AnnouncementOutlined";
import ReportIcon from "@mui/icons-material/Report";
import AssignmentIcon from "@mui/icons-material/Assignment";
import QuizIcon from "@mui/icons-material/Quiz";
import EventNoteIcon from "@mui/icons-material/EventNote";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SummarizeIcon from "@mui/icons-material/Summarize";
import BarChartIcon from "@mui/icons-material/BarChart";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import SchoolIcon from "@mui/icons-material/School";
import GroupsIcon from "@mui/icons-material/Groups";
import TopicIcon from "@mui/icons-material/Topic";

const SideBar = () => {
    const location = useLocation();
    const active = (path) => location.pathname.startsWith(path) ? "primary" : "inherit";
    return (
        <>
            <React.Fragment>
                <ListItemButton component={Link} to="/">
                    <ListItemIcon><HomeIcon color={location.pathname === "/" ? "primary" : "inherit"} /></ListItemIcon>
                    <ListItemText primary="Home" />
                </ListItemButton>

                <ListSubheader component="div" inset>Management</ListSubheader>

                <ListItemButton component={Link} to="/Admin/manage/teachers">
                    <ListItemIcon><ManageAccountsIcon color={active("/Admin/manage/teachers")} /></ListItemIcon>
                    <ListItemText primary="Teachers" />
                </ListItemButton>
                <ListItemButton component={Link} to="/Admin/manage/classes">
                    <ListItemIcon><SchoolIcon color={active("/Admin/manage/classes")} /></ListItemIcon>
                    <ListItemText primary="Classes" />
                </ListItemButton>
                <ListItemButton component={Link} to="/Admin/manage/students">
                    <ListItemIcon><GroupsIcon color={active("/Admin/manage/students")} /></ListItemIcon>
                    <ListItemText primary="Students" />
                </ListItemButton>
                <ListItemButton component={Link} to="/Admin/manage/subjects">
                    <ListItemIcon><TopicIcon color={active("/Admin/manage/subjects")} /></ListItemIcon>
                    <ListItemText primary="Subjects" />
                </ListItemButton>

                <ListSubheader component="div" inset>Academic</ListSubheader>

                <ListItemButton component={Link} to="/Admin/subjects">
                    <ListItemIcon><AssignmentIcon color={active("/Admin/subjects")} /></ListItemIcon>
                    <ListItemText primary="Subjects" />
                </ListItemButton>
                <ListItemButton component={Link} to="/Admin/assignments">
                    <ListItemIcon><AssignmentIcon color={active("/Admin/assignments")} /></ListItemIcon>
                    <ListItemText primary="Assignments" />
                </ListItemButton>
                <ListItemButton component={Link} to="/Admin/tests">
                    <ListItemIcon><QuizIcon color={active("/Admin/tests")} /></ListItemIcon>
                    <ListItemText primary="Tests" />
                </ListItemButton>
                <ListItemButton component={Link} to="/Admin/attendance">
                    <ListItemIcon><EventNoteIcon color={active("/Admin/attendance")} /></ListItemIcon>
                    <ListItemText primary="Attendance" />
                </ListItemButton>

                <ListSubheader component="div" inset>Communication</ListSubheader>

                <ListItemButton component={Link} to="/Admin/notices">
                    <ListItemIcon><AnnouncementOutlinedIcon color={active("/Admin/notices")} /></ListItemIcon>
                    <ListItemText primary="Notices" />
                </ListItemButton>
                <ListItemButton component={Link} to="/Admin/notifications">
                    <ListItemIcon><NotificationsIcon color={active("/Admin/notifications")} /></ListItemIcon>
                    <ListItemText primary="Notifications" />
                </ListItemButton>
                <ListItemButton component={Link} to="/Admin/complains">
                    <ListItemIcon><ReportIcon color={active("/Admin/complains")} /></ListItemIcon>
                    <ListItemText primary="Complains" />
                </ListItemButton>

                <ListSubheader component="div" inset>Insights</ListSubheader>

                <ListItemButton component={Link} to="/Admin/reports">
                    <ListItemIcon><SummarizeIcon color={active("/Admin/reports")} /></ListItemIcon>
                    <ListItemText primary="Reports" />
                </ListItemButton>
                <ListItemButton component={Link} to="/Admin/analytics">
                    <ListItemIcon><BarChartIcon color={active("/Admin/analytics")} /></ListItemIcon>
                    <ListItemText primary="Analytics" />
                </ListItemButton>
            </React.Fragment>

            <Divider sx={{ my: 1 }} />

            <React.Fragment>
                <ListSubheader component="div" inset>User</ListSubheader>
                <ListItemButton component={Link} to="/Admin/profile">
                    <ListItemIcon><AccountCircleOutlinedIcon color={active("/Admin/profile")} /></ListItemIcon>
                    <ListItemText primary="Profile" />
                </ListItemButton>
                <ListItemButton component={Link} to="/logout">
                    <ListItemIcon><ExitToAppIcon color={active("/logout")} /></ListItemIcon>
                    <ListItemText primary="Logout" />
                </ListItemButton>
            </React.Fragment>
        </>
    );
};

export default SideBar;
