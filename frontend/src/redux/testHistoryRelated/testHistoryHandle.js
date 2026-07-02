import axiosInstance from '../../utils/axiosInstance';
import {
    setLoading, setError, setRecords, setDetail,
    setAnalytics, setExportData, setTestResults,
} from './testHistorySlice';

// ── Student: fetch history list ───────────────────────────────────────────────
export const fetchStudentHistory = (studentId, params = {}) => async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
        const res = await axiosInstance.get(`/api/history/student/${studentId}`, { params });
        dispatch(setRecords({
            records: res.data.records || [],
            total:   res.data.total  || 0,
            page:    res.data.page   || 1,
            pages:   res.data.pages  || 1,
        }));
    } catch (e) {
        dispatch(setError(e.response?.data?.error?.message || 'Failed to load history'));
    } finally {
        dispatch(setLoading(false));
    }
};

// ── Student: fetch single attempt detail ──────────────────────────────────────
export const fetchAttemptDetail = (id) => async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
        const res = await axiosInstance.get(`/api/history/${id}`);
        dispatch(setDetail(res.data.record));
    } catch (e) {
        dispatch(setError(e.response?.data?.error?.message || 'Failed to load attempt detail'));
    } finally {
        dispatch(setLoading(false));
    }
};

// ── Student: fetch analytics ──────────────────────────────────────────────────
export const fetchStudentAnalytics = (studentId, params = {}) => async (dispatch) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
        const res = await axiosInstance.get(`/api/history/student/${studentId}/analytics`, { params });
        dispatch(setAnalytics(res.data.analytics));
    } catch (e) {
        dispatch(setError(e.response?.data?.error?.message || 'Failed to load analytics'));
    } finally {
        dispatch(setLoading(false));
    }
};

// ── Student: fetch export data ────────────────────────────────────────────────
export const fetchExportData = (studentId, id) => async (dispatch) => {
    dispatch(setLoading(true));
    try {
        const res = await axiosInstance.get(`/api/history/student/${studentId}/export/${id}`);
        dispatch(setExportData(res.data.exportData));
    } catch (e) {
        dispatch(setError(e.response?.data?.error?.message || 'Export failed'));
    } finally {
        dispatch(setLoading(false));
    }
};

// ── Teacher: fetch test attempts ──────────────────────────────────────────────
export const fetchTestAttempts = (testId, params = {}) => async (dispatch) => {
    dispatch(setLoading(true));
    try {
        const res = await axiosInstance.get(`/api/history/test/${testId}/results`, { params });
        dispatch(setTestResults({ records: res.data.records, questionStats: res.data.questionStats }));
    } catch (e) {
        dispatch(setError(e.response?.data?.error?.message || 'Failed to load results'));
    } finally {
        dispatch(setLoading(false));
    }
};

// ── Teacher: publish solutions ────────────────────────────────────────────────
export const publishTestSolutions = (testId) => async () => {
    await axiosInstance.post(`/api/history/test/${testId}/publish`);
};

// ── Teacher: compute ranks ────────────────────────────────────────────────────
export const computeTestRanks = (testId) => async () => {
    await axiosInstance.post(`/api/history/test/${testId}/ranks`);
};
