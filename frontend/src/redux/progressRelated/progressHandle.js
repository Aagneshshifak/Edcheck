import axiosInstance from '../../utils/axiosInstance';
import { progressFetchStart, progressFetchSuccess, progressFetchFailed } from './progressSlice';

export const fetchProgress = (studentId) => async (dispatch) => {
    dispatch(progressFetchStart());
    try {
        const result = await axiosInstance.get(`/StudentProgress/${studentId}`);
        dispatch(progressFetchSuccess(result.data));
    } catch (error) {
        dispatch(progressFetchFailed(error.message));
    }
};
