import { Drawer, List, ListItem, ListItemIcon, ListItemText, Toolbar, Box } from '@mui/material';
import { Dashboard, FamilyRestroom, EventNote, Logout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authLogout } from '../../redux/userRelated/userSlice';

const drawerWidth = 220;

const ParentSideBar = ({ open }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const items = [
        { text: 'Dashboard', icon: <Dashboard />, path: '/Parent/dashboard' },
        { text: 'My Children', icon: <FamilyRestroom />, path: '/Parent/dashboard' },
        { text: 'Attendance', icon: <EventNote />, path: '/Parent/attendance' },
    ];

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', bgcolor: '#2c2143', color: 'white' },
            }}
        >
            <Toolbar />
            <Box sx={{ overflow: 'auto' }}>
                <List>
                    {items.map(item => (
                        <ListItem button key={item.text} onClick={() => navigate(item.path)}>
                            <ListItemIcon sx={{ color: 'white' }}>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.text} />
                        </ListItem>
                    ))}
                    <ListItem button onClick={() => { dispatch(authLogout()); navigate('/'); }}>
                        <ListItemIcon sx={{ color: 'white' }}><Logout /></ListItemIcon>
                        <ListItemText primary="Logout" />
                    </ListItem>
                </List>
            </Box>
        </Drawer>
    );
};

export default ParentSideBar;
