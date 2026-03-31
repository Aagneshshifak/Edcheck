import axios from 'axios';
import { deadlinesFetchStart, deadlinesFetchSuccess, deadlinesFetchFailed } from './deadlinesSlice';

export const fetchDeadlines = (studentId) => async (dispatch) => {
    dispatch(deadlinesFetchStart());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/UpcomingDeadlines/${studentId}`);
        dispatch(deadlinesFetchSuccess(result.data));
    } catch (error) {
        dispatch(deadlinesFetchFailed(error.message));
    }
};
