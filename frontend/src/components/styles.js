import {
    TableCell,
    TableRow,
    styled,
    tableCellClasses,
    Drawer as MuiDrawer,
    AppBar as MuiAppBar,
} from "@mui/material";

export const drawerWidth = 260;

// ── Table ──────────────────────────────────────────────────────────────────
export const StyledTableCell = styled(TableCell)(({ theme }) => ({
    [`&.${tableCellClasses.head}`]: {
        background: '#111111',
        color: '#ffffff',
        fontWeight: 600,
        fontSize: '0.78rem',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        color: '#111111',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
    },
}));

export const StyledTableRow = styled(TableRow)(() => ({
    transition: 'background-color 0.15s ease',
    '&:nth-of-type(odd)': {
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    '&:hover': {
        backgroundColor: 'rgba(0,0,0,0.04) !important',
    },
    '&:last-child td, &:last-child th': {
        border: 0,
    },
}));

// ── AppBar ─────────────────────────────────────────────────────────────────
export const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
    zIndex: theme.zIndex.drawer + 1,
    background: '#111111',
    color: '#ffffff',
    boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    transition: theme.transitions.create(['width', 'margin'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

// ── Drawer ─────────────────────────────────────────────────────────────────
export const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
    ({ theme, open }) => ({
        '& .MuiDrawer-paper': {
            position: 'relative',
            whiteSpace: 'nowrap',
            width: drawerWidth,
            background: '#111111',
            color: '#ffffff',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
            transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
            }),
            boxSizing: 'border-box',
            overflowX: 'hidden',
            ...(!open && {
                transition: theme.transitions.create('width', {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.leavingScreen,
                }),
                width: 0,
                [theme.breakpoints.up('sm')]: {
                    width: 0,
                },
            }),
        },
    }),
);
