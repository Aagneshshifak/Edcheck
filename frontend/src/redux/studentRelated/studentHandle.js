import axiosInstance from '../../utils/axiosInstance';
import { getRequest, getSuccess, getFailed, getError, stuffDone } from './studentSlice';

export const getAllStudents = (id) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axiosInstance.get(`/Students/${id}`);
        if (result.data.message) dispatch(getFailed(result.data.message));
        else dispatch(getSuccess(result.data));
    } catch (error) { dispatch(getError(error.message)); }
};

export const updateStudentFields = (id, fields, address) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axiosInstance.put(`/${address}/${id}`, fields, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (result.data.message) dispatch(getFailed(result.data.message));
        else dispatch(stuffDone());
    } catch (error) { dispatch(getError(error.message)); }
};

export const removeStuff = (id, address) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axiosInstance.put(`/${address}/${id}`);
        if (result.data.message) dispatch(getFailed(result.data.message));
        else dispatch(stuffDone());
    } catch (error) { dispatch(getError(error.message)); }
};
