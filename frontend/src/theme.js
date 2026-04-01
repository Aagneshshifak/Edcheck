import { createTheme } from '@mui/material/styles';

const COLORS = {
    bg:        '#0f172a',
    surface:   '#111827',
    surfaceAlt:'#1e293b',
    border:    'rgba(14,165,233,0.15)',
    accent:    '#0ea5e9',
    accentDim: 'rgba(14,165,233,0.12)',
    text:      '#e2e8f0',
    textMuted: '#94a3b8',
    success:   '#10b981',
    warning:   '#f59e0b',
    error:     '#ef4444',
};

const theme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: COLORS.bg,
            paper:   COLORS.surface,
        },
        primary: {
            main:        COLORS.accent,
            contrastText:'#fff',
        },
        secondary: {
            main: '#6366f1',
        },
        text: {
            primary:   COLORS.text,
            secondary: COLORS.textMuted,
        },
        divider: COLORS.border,
        success: { main: COLORS.success },
        warning: { main: COLORS.warning },
        error:   { main: COLORS.error },
    },

    typography: {
        fontFamily: "'Inter', 'Poppins', sans-serif",
        h4: { fontWeight: 700, letterSpacing: '-0.02em' },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
        body2: { color: COLORS.textMuted },
    },

    shape: { borderRadius: 12 },

    components: {
        // ── Paper / Cards ──────────────────────────────────────────────────
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    backdropFilter: 'blur(12px)',
                    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                    '&:hover': {
                        borderColor: 'rgba(14,165,233,0.3)',
                    },
                },
            },
        },

        // ── AppBar ─────────────────────────────────────────────────────────
        MuiAppBar: {
            styleOverrides: {
                root: {
                    background: 'linear-gradient(135deg, #000428 0%, #004e92 100%)',
                    borderBottom: `1px solid ${COLORS.border}`,
                    boxShadow: '0 1px 20px rgba(0,0,0,0.4)',
                },
            },
        },

        // ── Drawer ─────────────────────────────────────────────────────────
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    background: 'linear-gradient(180deg, #0a0f1e 0%, #0f172a 100%)',
                    borderRight: `1px solid ${COLORS.border}`,
                    boxShadow: '4px 0 24px rgba(0,0,0,0.3)',
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
                    background: `linear-gradient(135deg, ${COLORS.accent} 0%, #0284c7 100%)`,
                    boxShadow: `0 4px 14px rgba(14,165,233,0.3)`,
                    '&:hover': {
                        boxShadow: `0 6px 20px rgba(14,165,233,0.45)`,
                        transform: 'translateY(-1px)',
                    },
                },
                outlined: {
                    borderColor: COLORS.border,
                    color: COLORS.accent,
                    '&:hover': {
                        borderColor: COLORS.accent,
                        backgroundColor: COLORS.accentDim,
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
                        backgroundColor: COLORS.accentDim,
                        transform: 'scale(1.1)',
                    },
                },
            },
        },

        // ── Table ──────────────────────────────────────────────────────────
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 12,
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: {
                    '& .MuiTableCell-head': {
                        background: 'linear-gradient(135deg, #000428 0%, #004e92 100%)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        borderBottom: `1px solid ${COLORS.border}`,
                    },
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                    '&:hover': {
                        backgroundColor: 'rgba(14,165,233,0.06) !important',
                        boxShadow: 'inset 0 0 0 1px rgba(14,165,233,0.2)',
                    },
                    '& .MuiTableCell-root': {
                        borderBottom: `1px solid ${COLORS.border}`,
                        color: COLORS.text,
                    },
                },
            },
        },

        // ── Inputs ─────────────────────────────────────────────────────────
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: COLORS.border,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(14,165,233,0.4)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: COLORS.accent,
                        boxShadow: `0 0 0 3px rgba(14,165,233,0.15)`,
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: { color: COLORS.textMuted },
            },
        },

        // ── Chips ──────────────────────────────────────────────────────────
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    fontWeight: 500,
                    fontSize: '0.75rem',
                },
                outlined: {
                    borderColor: COLORS.border,
                },
            },
        },

        // ── Tabs ───────────────────────────────────────────────────────────
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 500,
                    color: COLORS.textMuted,
                    '&.Mui-selected': { color: COLORS.accent, fontWeight: 700 },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: { backgroundColor: COLORS.accent, height: 3, borderRadius: 2 },
            },
        },

        // ── List items (sidebar) ───────────────────────────────────────────
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    margin: '2px 8px',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        backgroundColor: COLORS.accentDim,
                        paddingLeft: 20,
                    },
                    '&.Mui-selected': {
                        backgroundColor: COLORS.accentDim,
                        borderLeft: `3px solid ${COLORS.accent}`,
                    },
                },
            },
        },
        MuiListSubheader: {
            styleOverrides: {
                root: {
                    backgroundColor: 'transparent',
                    color: COLORS.textMuted,
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
                root: {
                    borderRadius: 8,
                    border: `1px solid`,
                },
                standardSuccess: { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.1)' },
                standardError:   { borderColor: 'rgba(239,68,68,0.3)',  backgroundColor: 'rgba(239,68,68,0.1)'  },
                standardWarning: { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.1)' },
                standardInfo:    { borderColor: 'rgba(14,165,233,0.3)', backgroundColor: 'rgba(14,165,233,0.1)' },
            },
        },

        // ── Dialog ─────────────────────────────────────────────────────────
        MuiDialog: {
            styleOverrides: {
                paper: {
                    background: COLORS.surfaceAlt,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    background: 'linear-gradient(135deg, #000428 0%, #004e92 100%)',
                    color: '#fff',
                    fontWeight: 700,
                },
            },
        },

        // ── Select / Menu ──────────────────────────────────────────────────
        MuiMenu: {
            styleOverrides: {
                paper: {
                    background: COLORS.surfaceAlt,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    transition: 'background-color 0.15s ease',
                    '&:hover': { backgroundColor: COLORS.accentDim },
                    '&.Mui-selected': { backgroundColor: 'rgba(14,165,233,0.2)' },
                },
            },
        },

        // ── LinearProgress ─────────────────────────────────────────────────
        MuiLinearProgress: {
            styleOverrides: {
                root: {
                    borderRadius: 4,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                },
            },
        },

        // ── Tooltip ────────────────────────────────────────────────────────
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: COLORS.surfaceAlt,
                    border: `1px solid ${COLORS.border}`,
                    color: COLORS.text,
                    fontSize: '0.75rem',
                    borderRadius: 6,
                },
            },
        },
    },
});

export default theme;
export { COLORS };
