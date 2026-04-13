import { createTheme } from '@mui/material/styles';

// ── Black & White Design Tokens ──────────────────────────────────────────────
export const COLORS = {
    bg:         '#ffffff',
    surface:    '#f5f5f5',
    surfaceAlt: '#eeeeee',
    sidebar:    '#111111',
    appBar:     '#111111',
    border:     'rgba(0,0,0,0.1)',
    borderDark: 'rgba(0,0,0,0.2)',
    accent:     '#111111',
    accentDim:  'rgba(0,0,0,0.07)',
    text:       '#111111',
    textMuted:  '#666666',
    textOnDark: '#ffffff',
    textMutedOnDark: 'rgba(255,255,255,0.55)',
    success:    '#16a34a',
    warning:    '#d97706',
    error:      '#dc2626',
    info:       '#2563eb',
};

const theme = createTheme({
    palette: {
        mode: 'light',
        background: {
            default: COLORS.bg,
            paper:   COLORS.surface,
        },
        primary: {
            main:        '#111111',
            contrastText:'#ffffff',
        },
        secondary: {
            main: '#444444',
        },
        text: {
            primary:   '#111111',
            secondary: '#111111',
            disabled:  'rgba(0,0,0,0.38)',
        },
        divider: COLORS.border,
        success: { main: COLORS.success },
        warning: { main: COLORS.warning },
        error:   { main: COLORS.error },
        info:    { main: COLORS.info },
    },

    typography: {
        fontFamily: "'Inter', 'Poppins', sans-serif",
        h4: { fontWeight: 700, letterSpacing: '-0.02em', color: '#111111' },
        h5: { fontWeight: 600, color: '#111111' },
        h6: { fontWeight: 600, color: '#111111' },
        body1: { color: '#111111' },
        body2: { color: '#111111' },
        caption: { color: '#111111' },
        subtitle1: { color: '#111111' },
        subtitle2: { color: '#111111' },
    },

    shape: { borderRadius: 12 },

    components: {
        // ── Paper / Cards ──────────────────────────────────────────────────
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    border: `1px solid rgba(255,255,255,0.1)`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'box-shadow 0.2s ease',
                    // Force all text inside Paper to be white
                    '& > .MuiTypography-root, & .MuiTypography-root:not(.MuiTableCell-root .MuiTypography-root)': {
                        color: 'inherit',
                    },
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
                    background: '#111111',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    '&:hover': {
                        background: '#333333',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                        transform: 'translateY(-1px)',
                    },
                },
                outlined: {
                    borderColor: 'rgba(0,0,0,0.25)',
                    color: '#111111',
                    '&:hover': {
                        borderColor: '#111111',
                        backgroundColor: 'rgba(0,0,0,0.04)',
                    },
                },
            },
        },

        // ── IconButton ─────────────────────────────────────────────────────
        MuiIconButton: {
            styleOverrides: {
                root: {
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.06)',
                    },
                },
            },
        },

        // ── Table ──────────────────────────────────────────────────────────
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    backgroundColor: '#000000',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    '& .MuiTableCell-head': {
                        background: '#111111',
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
                        backgroundColor: '#ffffff',
                    },
                    '&:not(.MuiTableRow-head):nth-of-type(odd)': {
                        backgroundColor: '#fafafa',
                    },
                    '&:not(.MuiTableRow-head):hover': {
                        backgroundColor: '#f0f0f0 !important',
                    },
                    // Body cells — black text
                    '& .MuiTableCell-body': {
                        borderBottom: `1px solid rgba(0,0,0,0.06)`,
                        color: '#111111 !important',
                        backgroundColor: 'transparent',
                    },
                    // Head cells — white text on black
                    '& .MuiTableCell-head': {
                        color: '#ffffff !important',
                        backgroundColor: '#111111',
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
                    backgroundColor: '#ffffff',
                    color: '#111111',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0,0,0,0.2)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0,0,0,0.4)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#111111',
                        boxShadow: '0 0 0 3px rgba(0,0,0,0.08)',
                    },
                    '& input': { color: '#111111' },
                    '& textarea': { color: '#111111' },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: { color: '#111111', '&.Mui-focused': { color: '#111111' } },
            },
        },
        MuiSelect: {
            styleOverrides: {
                icon: { color: '#111111' },
            },
        },

        // ── Chips ──────────────────────────────────────────────────────────
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    backgroundColor: '#f0f0f0',
                    color: '#111111',
                    border: '1px solid rgba(0,0,0,0.1)',
                },
                colorSuccess: { backgroundColor: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' },
                colorError:   { backgroundColor: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' },
                colorWarning: { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' },
                colorInfo:    { backgroundColor: '#dbeafe', color: '#1d4ed8', borderColor: '#bfdbfe' },
            },
        },

        // ── Tabs ───────────────────────────────────────────────────────────
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 500,
                    color: '#111111',
                    '&.Mui-selected': { color: '#111111', fontWeight: 700 },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: { backgroundColor: '#111111', height: 3, borderRadius: 2 },
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
                standardSuccess: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', color: '#15803d' },
                standardError:   { borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#b91c1c' },
                standardWarning: { borderColor: '#fde68a', backgroundColor: '#fffbeb', color: '#92400e' },
                standardInfo:    { borderColor: '#bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8' },
            },
        },

        // ── Dialog ─────────────────────────────────────────────────────────
        MuiDialog: {
            styleOverrides: {
                paper: {
                    background: '#ffffff',
                    color: '#111111',
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                    '& .MuiTypography-root': {
                        color: '#111111',
                    },
                    '& .MuiDialogContent-root': {
                        color: '#111111',
                    },
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    background: '#111111',
                    color: '#ffffff',
                    fontWeight: 700,
                    '& .MuiTypography-root': {
                        color: '#ffffff',
                    },
                },
            },
        },
        MuiDialogContent: {
            styleOverrides: {
                root: {
                    color: '#111111',
                    '& .MuiTypography-root': {
                        color: '#111111',
                    },
                },
            },
        },

        // ── Select / Menu ──────────────────────────────────────────────────
        MuiMenu: {
            styleOverrides: {
                paper: {
                    background: '#ffffff',
                    color: '#111111',
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    color: '#111111',
                    transition: 'background-color 0.15s ease',
                    '&:hover': { backgroundColor: 'rgba(0,0,0,0.05)' },
                    '&.Mui-selected': { backgroundColor: 'rgba(0,0,0,0.08)' },
                },
            },
        },

        // ── LinearProgress ─────────────────────────────────────────────────
        MuiLinearProgress: {
            styleOverrides: {
                root: {
                    borderRadius: 4,
                    backgroundColor: 'rgba(0,0,0,0.08)',
                },
                bar: { backgroundColor: '#111111' },
            },
        },

        // ── Tooltip ────────────────────────────────────────────────────────
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: '#111111',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    borderRadius: 6,
                },
            },
        },

        // ── Card ───────────────────────────────────────────────────────────
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    borderRadius: 12,
                },
            },
        },
    },
});

export default theme;
