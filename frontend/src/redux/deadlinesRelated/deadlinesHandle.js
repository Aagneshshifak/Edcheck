import axiosInstance from '../../utils/axiosInstance';
import { deadlinesFetchStart, deadlinesFetchSuccess, deadlinesFetchFailed } from './deadlinesSlice';

export const fetchDeadlines = (studentId) => async (dispatch) => {
    dispatch(deadlinesFetchStart());
    try {
        const result = await axiosInstance.get(`/UpcomingDeadlines/${studentId}`);
        dispatch(deadlinesFetchSuccess(result.data));
    } catch (error) {
        dispatch(deadlinesFetchFailed(error.message));
    }
};
