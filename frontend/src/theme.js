import { createTheme } from '@mui/material/styles';

// ── Black & White Design Tokens ──────────────────────────────────────────────
export const COLORS = {
    bg:         '#111111',
    surface:    '#1a1a1a',
    surfaceAlt: '#222222',
    sidebar:    '#000000',
    appBar:     '#000000',
    border:     'rgba(255,255,255,0.1)',
    borderDark: 'rgba(255,255,255,0.2)',
    accent:     '#ffffff',
    accentDim:  'rgba(255,255,255,0.07)',
    text:       '#ffffff',
    textMuted:  '#aaaaaa',
    textOnDark: '#ffffff',
    textMutedOnDark: 'rgba(255,255,255,0.55)',
    success:    '#16a34a',
    warning:    '#d97706',
    error:      '#dc2626',
    info:       '#2563eb',
};

const theme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#111111',
            paper:   '#1a1a1a',
        },
        primary: {
            main:        '#ffffff',
            contrastText:'#111111',
        },
        secondary: {
            main: '#aaaaaa',
        },
        text: {
            primary:   '#ffffff',
            secondary: 'rgba(255,255,255,0.65)',
            disabled:  'rgba(255,255,255,0.38)',
        },
        divider: 'rgba(255,255,255,0.1)',
        success: { main: COLORS.success },
        warning: { main: COLORS.warning },
        error:   { main: COLORS.error },
        info:    { main: COLORS.info },
    },

    typography: {
        fontFamily: "'Inter', 'Poppins', sans-serif",
        h4: { fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' },
        h5: { fontWeight: 600, color: '#ffffff' },
        h6: { fontWeight: 600, color: '#ffffff' },
        body1: { color: '#ffffff' },
        body2: { color: 'rgba(255,255,255,0.75)' },
        caption: { color: 'rgba(255,255,255,0.55)' },
        subtitle1: { color: '#ffffff' },
        subtitle2: { color: 'rgba(255,255,255,0.75)' },
    },

    shape: { borderRadius: 12 },

    components: {
        // ── Paper / Cards ──────────────────────────────────────────────────
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#1a1a1a',
                    color: '#ffffff',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    transition: 'box-shadow 0.2s ease',
                },
            },
        },

        // ── AppBar ─────────────────────────────────────────────────────────
        MuiAppBar: {
            styleOverrides: {
                root: {
                    background: '#111111',
                    borderBottom: `1px solid rgba(255,255,255,0.08)`,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                    color: '#ffffff',
                },
            },
        },

        // ── Drawer ─────────────────────────────────────────────────────────
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    background: '#111111',
                    borderRight: `1px solid rgba(255,255,255,0.08)`,
                    boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
                    color: '#ffffff',
                },
            },
        },

        // ── Buttons ────────────────────────────────────────────────────────
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    textTransform: 'none',
                    fontWeight: 600,
                    transition: 'all 0.2s ease',
                },
                contained: {
                    background: '#ffffff',
                    color: '#111111',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    '&:hover': {
                        background: '#e0e0e0',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                        transform: 'translateY(-1px)',
                    },
                },
                outlined: {
                    borderColor: 'rgba(255,255,255,0.25)',
                    color: '#ffffff',
                    '&:hover': {
                        borderColor: '#ffffff',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                    },
                },
            },
        },

        // ── IconButton ─────────────────────────────────────────────────────
        MuiIconButton: {
            styleOverrides: {
                root: {
                    color: '#ffffff',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.08)',
                    },
                },
            },
        },

        // ── Table ──────────────────────────────────────────────────────────
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    backgroundColor: '#1a1a1a',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    '& .MuiTableCell-head': {
                        background: '#000000',
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        borderBottom: 'none',
                    },
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    transition: 'background-color 0.15s ease',
                    '&:not(.MuiTableRow-head)': {
                        backgroundColor: '#1a1a1a',
                    },
                    '&:not(.MuiTableRow-head):nth-of-type(odd)': {
                        backgroundColor: '#222222',
                    },
                    '&:not(.MuiTableRow-head):hover': {
                        backgroundColor: '#2a2a2a !important',
                    },
                    '& .MuiTableCell-body': {
                        borderBottom: `1px solid rgba(255,255,255,0.06)`,
                        color: '#ffffff !important',
                        backgroundColor: 'transparent',
                    },
                    '& .MuiTableCell-head': {
                        color: '#ffffff !important',
                        backgroundColor: '#000000',
                        borderBottom: 'none',
                    },
                },
            },
        },

        // ── Inputs ─────────────────────────────────────────────────────────
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    backgroundColor: '#2a2a2a',
                    color: '#ffffff',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.2)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.4)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#ffffff',
                        boxShadow: '0 0 0 3px rgba(255,255,255,0.08)',
                    },
                    '& input': { color: '#ffffff' },
                    '& textarea': { color: '#ffffff' },
                    '& input[type="date"]::-webkit-calendar-picker-indicator': { filter: 'invert(1)' },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: { color: 'rgba(255,255,255,0.6)', '&.Mui-focused': { color: '#ffffff' } },
            },
        },
        MuiSelect: {
            styleOverrides: {
                icon: { color: '#ffffff' },
            },
        },

        // ── Chips ──────────────────────────────────────────────────────────
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    backgroundColor: '#333333',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.12)',
                },
                colorSuccess: { backgroundColor: '#14532d', color: '#86efac', borderColor: '#166534' },
                colorError:   { backgroundColor: '#7f1d1d', color: '#fca5a5', borderColor: '#991b1b' },
                colorWarning: { backgroundColor: '#78350f', color: '#fcd34d', borderColor: '#92400e' },
                colorInfo:    { backgroundColor: '#1e3a5f', color: '#93c5fd', borderColor: '#1d4ed8' },
            },
        },

        // ── Tabs ───────────────────────────────────────────────────────────
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.5)',
                    '&.Mui-selected': { color: '#ffffff', fontWeight: 700 },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: { backgroundColor: '#ffffff', height: 3, borderRadius: 2 },
            },
        },

        // ── List items (sidebar) ───────────────────────────────────────────
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    margin: '2px 8px',
                    transition: 'all 0.18s ease',
                    '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.1)',
                    },
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        borderLeft: '3px solid #ffffff',
                    },
                },
            },
        },
        MuiListSubheader: {
            styleOverrides: {
                root: {
                    backgroundColor: 'transparent',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    lineHeight: '2.5',
                },
            },
        },

        // ── Divider ────────────────────────────────────────────────────────
        MuiDivider: {
            styleOverrides: {
                root: { borderColor: COLORS.border },
            },
        },

        // ── Alert ──────────────────────────────────────────────────────────
        MuiAlert: {
            styleOverrides: {
                root: { borderRadius: 8, border: '1px solid' },
                standardSuccess: { borderColor: '#166534', backgroundColor: '#14532d', color: '#86efac' },
                standardError:   { borderColor: '#991b1b', backgroundColor: '#7f1d1d', color: '#fca5a5' },
                standardWarning: { borderColor: '#92400e', backgroundColor: '#78350f', color: '#fcd34d' },
                standardInfo:    { borderColor: '#1d4ed8', backgroundColor: '#1e3a5f', color: '#93c5fd' },
            },
        },

        // ── Dialog ─────────────────────────────────────────────────────────
        MuiDialog: {
            styleOverrides: {
                paper: {
                    background: '#1a1a1a',
                    color: '#ffffff',
                    border: `1px solid rgba(255,255,255,0.1)`,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                    '& .MuiTypography-root': { color: '#ffffff' },
                    '& .MuiDialogContent-root': { color: '#ffffff' },
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    background: '#000000',
                    color: '#ffffff',
                    fontWeight: 700,
                    '& .MuiTypography-root': { color: '#ffffff' },
                },
            },
        },
        MuiDialogContent: {
            styleOverrides: {
                root: {
                    color: '#ffffff',
                    '& .MuiTypography-root': { color: '#ffffff' },
                },
            },
        },

        // ── Select / Menu ──────────────────────────────────────────────────
        MuiMenu: {
            styleOverrides: {
                paper: {
                    background: '#1a1a1a',
                    color: '#ffffff',
                    border: `1px solid rgba(255,255,255,0.1)`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    color: '#ffffff',
                    transition: 'background-color 0.15s ease',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
                    '&.Mui-selected': { backgroundColor: 'rgba(255,255,255,0.12)' },
                },
            },
        },

        // ── LinearProgress ─────────────────────────────────────────────────
        MuiLinearProgress: {
            styleOverrides: {
                root: {
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                },
                bar: { backgroundColor: '#ffffff' },
            },
        },

        // ── Tooltip ────────────────────────────────────────────────────────
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                },
            },
        },

        // ── Card ───────────────────────────────────────────────────────────
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: '#1a1a1a',
                    color: '#ffffff',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    borderRadius: 12,
                },
            },
        },

        // ── CssBaseline — force dark body ──────────────────────────────────
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: '#111111',
                    color: '#ffffff',
                },
            },
        },
    },
});

export default theme;
