import axios from 'axios';
import { progressFetchStart, progressFetchSuccess, progressFetchFailed } from './progressSlice';

export const fetchProgress = (studentId) => async (dispatch) => {
    dispatch(progressFetchStart());
    try {
        const result = await axios.get(`${process.env.REACT_APP_BASE_URL}/StudentProgress/${studentId}`);
        dispatch(progressFetchSuccess(result.data));
    } catch (error) {
        dispatch(progressFetchFailed(error.message));
    }
};
