import axiosInstance from '../../utils/axiosInstance';
import axios from 'axios'; // kept for login/register (no token needed yet)
import {
    authRequest, stuffAdded, authSuccess, authFailed, authError,
    authLogout, doneSuccess, getRequest, getFailed, getError,
} from './userSlice';

const BASE = process.env.REACT_APP_BASE_URL;

// Login — uses plain axios (no token exists yet)
export const loginUser = (fields, role) => async (dispatch) => {
    dispatch(authRequest());
    try {
        const result = await axios.post(`${BASE}/${role}Login`, fields, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (result.data.role) {
            dispatch(authSuccess(result.data)); // result.data includes token
        } else {
            dispatch(authFailed(result.data.message));
        }
    } catch (error) {
        dispatch(authError(error.message));
    }
};

// Register — uses plain axios (no token exists yet)
export const registerUser = (fields, role) => async (dispatch) => {
    dispatch(authRequest());
    try {
        const result = await axios.post(`${BASE}/${role}Reg`, fields, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (result.data.schoolName) {
            dispatch(authSuccess(result.data));
        } else if (result.data.school) {
            dispatch(stuffAdded());
        } else {
            dispatch(authFailed(result.data.message));
        }
    } catch (error) {
        dispatch(authError(error.message));
    }
};

export const logoutUser = () => (dispatch) => {
    dispatch(authLogout());
};

// All authenticated calls use axiosInstance (token attached automatically)
export const getUserDetails = (id, address) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axiosInstance.get(`/${address}/${id}`);
        if (result.data) {
            dispatch(doneSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error.message));
    }
};

export const deleteUser = (id, address) => async (dispatch) => {
    dispatch(getRequest());
    try {
        await axiosInstance.delete(`/${address}/${id}`);
        dispatch(doneSuccess({}));
    } catch (error) {
        dispatch(getError(error.message));
    }
};

export const updateUser = (fields, id, address) => async (dispatch) => {
    dispatch(getRequest());
    try {
        const result = await axiosInstance.put(`/${address}/${id}`, fields, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (result.data.schoolName) {
            dispatch(authSuccess(result.data));
        } else {
            dispatch(doneSuccess(result.data));
        }
    } catch (error) {
        dispatch(getError(error.message));
    }
};

export const addStuff = (fields, address) => async (dispatch) => {
    dispatch(authRequest());
    try {
        const result = await axiosInstance.post(`/${address}Create`, fields, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (result.data.message) {
            dispatch(authFailed(result.data.message));
        } else {
            dispatch(stuffAdded(result.data));
        }
    } catch (error) {
        dispatch(authError(error.message));
    }
};
