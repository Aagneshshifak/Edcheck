import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    records:     [],
    total:       0,
    page:        1,
    pages:       1,
    loading:     false,
    error:       null,
    detail:      null,
    analytics:   null,
    exportData:  null,
    testResults: [],          // teacher view
    questionStats: [],
};

const testHistorySlice = createSlice({
    name: 'testHistory',
    initialState,
    reducers: {
        setLoading:      (s, a) => { s.loading = a.payload; },
        setError:        (s, a) => { s.error   = a.payload; },
        setRecords:      (s, a) => {
            s.records = a.payload.records;
            s.total   = a.payload.total;
            s.page    = a.payload.page;
            s.pages   = a.payload.pages;
        },
        setDetail:       (s, a) => { s.detail     = a.payload; },
        setAnalytics:    (s, a) => { s.analytics  = a.payload; },
        setExportData:   (s, a) => { s.exportData = a.payload; },
        setTestResults:  (s, a) => {
            s.testResults  = a.payload.records || [];
            s.questionStats = a.payload.questionStats || [];
        },
        clearHistory:    ()     => initialState,
    },
});

export const {
    setLoading, setError, setRecords, setDetail,
    setAnalytics, setExportData, setTestResults, clearHistory,
} = testHistorySlice.actions;

export default testHistorySlice.reducer;
