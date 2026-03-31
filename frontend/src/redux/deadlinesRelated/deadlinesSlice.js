import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    deadlines: [],
    deadlinesLoading: false,
    deadlinesError: null,
};

const deadlinesSlice = createSlice({
    name: 'deadlines',
    initialState,
    reducers: {
        deadlinesFetchStart: (state) => {
            state.deadlinesLoading = true;
            state.deadlinesError = null;
            state.deadlines = [];
        },
        deadlinesFetchSuccess: (state, action) => {
            state.deadlines = action.payload;
            state.deadlinesLoading = false;
            state.deadlinesError = null;
        },
        deadlinesFetchFailed: (state, action) => {
            state.deadlinesLoading = false;
            state.deadlinesError = action.payload;
        },
    },
});

export const {
    deadlinesFetchStart,
    deadlinesFetchSuccess,
    deadlinesFetchFailed,
} = deadlinesSlice.actions;

export default deadlinesSlice.reducer;
