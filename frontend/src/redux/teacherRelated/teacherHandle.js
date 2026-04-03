import axiosInstance from '../../utils/axiosInstance';
import { getRequest, getSuccess, getFailed, getError, postDone, doneSuccess } from './teacherSlice';

export const getAllTeachers = (id) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axiosInstance.get(`/Teachers/${id}`);
        if (result.data.message) dispatch(getFailed(result.data.message));
        else dispatch(getSuccess(result.data));
    } catch (error) { dispatch(getError(error.message)); }
};

export const getTeacherDetails = (id) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axiosInstance.get(`/Teacher/${id}`);
        if (result.data) dispatch(doneSuccess(result.data));
    } catch (error) { dispatch(getError(error.message)); }
};

export const updateTeachSubject = (teacherId, teachSubject) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axiosInstance.put(`/TeacherSubject`, { teacherId, teachSubject }, {
            headers: { 'Content-Type': 'application/json' },
        });
        dispatch(postDone());
    } catch (error) { dispatch(getError(error.message)); }
};
