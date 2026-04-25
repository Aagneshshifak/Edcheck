import axiosInstance from '../../utils/axiosInstance';
import { setNotifications, markOneRead, markAllRead, removeOne, removeAllRead, setLoading } from "./notificationSlice";

export const fetchNotifications = (userId, before = null) => async (dispatch, getState) => {
    dispatch(setLoading());
    try {
        const url = before
            ? `/Notifications/${userId}?before=${before}&limit=20`
            : `/Notifications/${userId}?limit=20`;
        const { data } = await axiosInstance.get(url);
        const existing = getState().notifications.items;
        const items = before ? [...existing, ...data.notifications] : data.notifications;
        dispatch(setNotifications({ items, hasMore: data.hasMore, nextCursor: data.nextCursor }));
    } catch (_) {}
};

export const readNotification = (id) => async (dispatch) => {
    dispatch(markOneRead(id));
    try { await axiosInstance.put(`/Notifications/read/${id}`); } catch (_) {}
};

export const readAllNotifications = (userId) => async (dispatch) => {
    dispatch(markAllRead());
    try { await axiosInstance.put(`/Notifications/readAll/${userId}`); } catch (_) {}
};

export const deleteNotification = (id) => async (dispatch) => {
    dispatch(removeOne(id));
    try { await axiosInstance.delete(`/Notifications/${id}`); } catch (_) {}
};

export const deleteReadNotifications = (userId) => async (dispatch) => {
    dispatch(removeAllRead());
    try { await axiosInstance.delete(`/Notifications/read/${userId}`); } catch (_) {}
};
