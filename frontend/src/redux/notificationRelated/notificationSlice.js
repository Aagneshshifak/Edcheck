import { createSlice } from "@reduxjs/toolkit";

const notificationSlice = createSlice({
    name: "notifications",
    initialState: { items: [], loading: false },
    reducers: {
        setNotifications: (state, action) => {
            state.items = action.payload;
            state.loading = false;
        },
        markOneRead: (state, action) => {
            const n = state.items.find((i) => i._id === action.payload);
            if (n) n.readStatus = true;
        },
        markAllRead: (state) => {
            state.items.forEach((i) => { i.readStatus = true; });
        },
        setLoading: (state) => { state.loading = true; },
    },
});

export const { setNotifications, markOneRead, markAllRead, setLoading } = notificationSlice.actions;
export default notificationSlice.reducer;
