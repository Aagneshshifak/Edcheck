import { createSlice } from "@reduxjs/toolkit";

const notificationSlice = createSlice({
    name: "notifications",
    initialState: { items: [], loading: false, hasMore: false, nextCursor: null },
    reducers: {
        setNotifications: (state, action) => {
            state.items      = action.payload.items;
            state.hasMore    = action.payload.hasMore ?? false;
            state.nextCursor = action.payload.nextCursor ?? null;
            state.loading    = false;
        },
        markOneRead: (state, action) => {
            const n = state.items.find((i) => i._id === action.payload);
            if (n) n.readStatus = true;
        },
        markAllRead: (state) => {
            state.items.forEach((i) => { i.readStatus = true; });
        },
        removeOne: (state, action) => {
            state.items = state.items.filter(i => i._id !== action.payload);
        },
        removeAllRead: (state) => {
            state.items = state.items.filter(i => !i.readStatus);
        },
        setLoading: (state) => { state.loading = true; },
    },
});

export const { setNotifications, markOneRead, markAllRead, removeOne, removeAllRead, setLoading } = notificationSlice.actions;
export default notificationSlice.reducer;
