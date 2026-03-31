import axios from "axios";
import { setNotifications, markOneRead, markAllRead, setLoading } from "./notificationSlice";

const BASE = process.env.REACT_APP_BASE_URL;

export const fetchNotifications = (userId) => async (dispatch) => {
    dispatch(setLoading());
    try {
        const { data } = await axios.get(`${BASE}/Notifications/${userId}`);
        dispatch(setNotifications(data));
    } catch (_) {}
};

export const readNotification = (id) => async (dispatch) => {
    dispatch(markOneRead(id));
    try { await axios.put(`${BASE}/Notifications/read/${id}`); } catch (_) {}
};

export const readAllNotifications = (userId) => async (dispatch) => {
    dispatch(markAllRead());
    try { await axios.put(`${BASE}/Notifications/readAll/${userId}`); } catch (_) {}
};
