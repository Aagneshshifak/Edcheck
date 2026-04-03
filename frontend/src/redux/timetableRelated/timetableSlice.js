import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/axiosInstance';

export const fetchWeeklyTimetable = createAsyncThunk(
  'timetable/fetchWeekly',
  async (classId, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get(`/Timetable/${classId}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchDailyTimetable = createAsyncThunk(
  'timetable/fetchDaily',
  async ({ classId, day }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get(`/Timetable/${classId}/${day}`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) return null;
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const savePeriod = createAsyncThunk(
  'timetable/savePeriod',
  async ({ classId, day, periods, schoolId }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.post(`/Timetable/${classId}/${day}`, { periods, schoolId });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const deleteDayTimetable = createAsyncThunk(
  'timetable/deleteDay',
  async ({ classId, day }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.delete(`/Timetable/${classId}/${day}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const markTeacherAttendance = createAsyncThunk(
  'timetable/markTeacherAttendance',
  async ({ teacherId, date, schoolId, status }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.post(`/TeacherAttendance`, { teacherId, date, schoolId, status });
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchSubstituteAlerts = createAsyncThunk(
  'timetable/fetchSubstituteAlerts',
  async ({ classId, date }, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get(`/Substitute/${classId}/${date}`);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

const timetableSlice = createSlice({
  name: 'timetable',
  initialState: {
    weeklyTimetable: {},
    dailyTimetable: [],
    loading: false,
    error: null,
    substituteAlerts: [],
  },
  reducers: {},
  extraReducers: (builder) => {
    // fetchWeeklyTimetable
    builder
      .addCase(fetchWeeklyTimetable.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWeeklyTimetable.fulfilled, (state, action) => {
        state.loading = false;
        state.weeklyTimetable = action.payload;
      })
      .addCase(fetchWeeklyTimetable.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // fetchDailyTimetable
    builder
      .addCase(fetchDailyTimetable.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyTimetable.fulfilled, (state, action) => {
        state.loading = false;
        // null means 404 (no timetable yet) — keep as empty array
        state.dailyTimetable = action.payload?.periods || [];
      })
      .addCase(fetchDailyTimetable.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // savePeriod
    builder
      .addCase(savePeriod.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(savePeriod.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(savePeriod.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // deleteDayTimetable
    builder
      .addCase(deleteDayTimetable.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteDayTimetable.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(deleteDayTimetable.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // markTeacherAttendance
    builder
      .addCase(markTeacherAttendance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(markTeacherAttendance.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(markTeacherAttendance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // fetchSubstituteAlerts
    builder
      .addCase(fetchSubstituteAlerts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSubstituteAlerts.fulfilled, (state, action) => {
        state.loading = false;
        state.substituteAlerts = action.payload;
      })
      .addCase(fetchSubstituteAlerts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default timetableSlice.reducer;
