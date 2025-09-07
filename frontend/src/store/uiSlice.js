import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    theme: 'light',
    loading: {
      global: false,
      contracts: false,
      templates: false,
      users: false,
    },
    modals: {
      createContract: false,
      createTemplate: false,
      userSettings: false,
      confirmation: null,
    },
    toasts: [],
    filters: {
      contracts: {
        search: '',
        status: '',
        type: '',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
      templates: {
        search: '',
        category: '',
        sortBy: 'name',
      },
    },
  },
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setLoading: (state, action) => {
      const { key, value } = action.payload;
      if (key) {
        state.loading[key] = value;
      } else {
        state.loading.global = value;
      }
    },
    openModal: (state, action) => {
      const modalName = action.payload;
      state.modals[modalName] = true;
    },
    closeModal: (state, action) => {
      const modalName = action.payload;
      state.modals[modalName] = false;
    },
    setConfirmationModal: (state, action) => {
      state.modals.confirmation = action.payload;
    },
    addToast: (state, action) => {
      state.toasts.push({
        id: Date.now(),
        ...action.payload,
      });
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter(toast => toast.id !== action.payload);
    },
    updateFilters: (state, action) => {
      const { section, filters } = action.payload;
      state.filters[section] = { ...state.filters[section], ...filters };
    },
    resetFilters: (state, action) => {
      const section = action.payload;
      state.filters[section] = uiSlice.getInitialState().filters[section];
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  setLoading,
  openModal,
  closeModal,
  setConfirmationModal,
  addToast,
  removeToast,
  updateFilters,
  resetFilters,
} = uiSlice.actions;

export default uiSlice.reducer;