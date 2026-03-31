import axios from "axios";
import { setNotifications, markOneRead, markAllRead, setLoading } from "./notificationSlice";

const BASE = process.env.REACT_APP_BASE_URL;

export const fetchNotifications = (userId, before = null) => async (dispatch, getState) => {
    dispatch(setLoading());
    try {
        const url = before
            ? `${BASE}/Notifications/${userId}?before=${before}&limit=20`
            : `${BASE}/Notifications/${userId}?limit=20`;
        const { data } = await axios.get(url);
        const existing = getState().notifications.items;
        // On initial load replace; on lazy-load append
        const items = before ? [...existing, ...data.notifications] : data.notifications;
        dispatch(setNotifications({ items, hasMore: data.hasMore, nextCursor: data.nextCursor }));
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
