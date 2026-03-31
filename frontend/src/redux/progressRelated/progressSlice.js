import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    data: [],
    loading: false,
    error: null,
};

const progressSlice = createSlice({
    name: 'progress',
    initialState,
    reducers: {
        progressFetchStart: (state) => {
            state.loading = true;
            state.error = null;
            state.data = [];
        },
        progressFetchSuccess: (state, action) => {
            state.data = action.payload;
            state.loading = false;
            state.error = null;
        },
        progressFetchFailed: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
    },
});

export const {
    progressFetchStart,
    progressFetchSuccess,
    progressFetchFailed,
} = progressSlice.actions;

export default progressSlice.reducer;
