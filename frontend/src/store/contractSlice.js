import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../services/api';

// Async thunks
export const fetchContracts = createAsyncThunk(
  'contracts/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await apiService.contracts.getAll(params);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchContract = createAsyncThunk(
  'contracts/fetchOne',
  async (id, { rejectWithValue }) => {
    try {
      const response = await apiService.contracts.getById(id);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const createContract = createAsyncThunk(
  'contracts/create',
  async (contractData, { rejectWithValue }) => {
    try {
      const response = await apiService.contracts.create(contractData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateContract = createAsyncThunk(
  'contracts/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await apiService.contracts.update(id, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const deleteContract = createAsyncThunk(
  'contracts/delete',
  async (id, { rejectWithValue }) => {
    try {
      await apiService.contracts.delete(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateContractStatus = createAsyncThunk(
  'contracts/updateStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const response = await apiService.contracts.updateStatus(id, status);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const bulkDeleteContracts = createAsyncThunk(
  'contracts/bulkDelete',
  async (ids, { rejectWithValue }) => {
    try {
      await apiService.contracts.bulkDelete(ids);
      return ids;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Slice
const contractSlice = createSlice({
  name: 'contracts',
  initialState: {
    contracts: [],
    currentContract: null,
    totalCount: 0,
    currentPage: 1,
    totalPages: 1,
    filters: {
      search: '',
      status: '',
      type: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
    loading: false,
    error: null,
  },
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.currentPage = 1;
    },
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateContractInList: (state, action) => {
      const index = state.contracts.findIndex(c => c._id === action.payload._id);
      if (index !== -1) {
        state.contracts[index] = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all contracts
      .addCase(fetchContracts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContracts.fulfilled, (state, action) => {
        state.contracts = action.payload.contracts;
        state.totalCount = action.payload.totalCount;
        state.totalPages = action.payload.totalPages;
        state.loading = false;
      })
      .addCase(fetchContracts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch contracts';
      })
      
      // Fetch single contract
      .addCase(fetchContract.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContract.fulfilled, (state, action) => {
        state.currentContract = action.payload.contract;
        state.loading = false;
      })
      .addCase(fetchContract.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch contract';
      })
      
      // Create contract
      .addCase(createContract.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createContract.fulfilled, (state, action) => {
        state.contracts.unshift(action.payload.contract);
        state.totalCount += 1;
        state.loading = false;
      })
      .addCase(createContract.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to create contract';
      })
      
      // Update contract
      .addCase(updateContract.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateContract.fulfilled, (state, action) => {
        const index = state.contracts.findIndex(c => c._id === action.payload.contract._id);
        if (index !== -1) {
          state.contracts[index] = action.payload.contract;
        }
        if (state.currentContract?._id === action.payload.contract._id) {
          state.currentContract = action.payload.contract;
        }
        state.loading = false;
      })
      .addCase(updateContract.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to update contract';
      })
      
      // Delete contract
      .addCase(deleteContract.fulfilled, (state, action) => {
        state.contracts = state.contracts.filter(c => c._id !== action.payload);
        state.totalCount -= 1;
        if (state.currentContract?._id === action.payload) {
          state.currentContract = null;
        }
      })
      
      // Update contract status
      .addCase(updateContractStatus.fulfilled, (state, action) => {
        const index = state.contracts.findIndex(c => c._id === action.payload.contract._id);
        if (index !== -1) {
          state.contracts[index] = action.payload.contract;
        }
        if (state.currentContract?._id === action.payload.contract._id) {
          state.currentContract = action.payload.contract;
        }
      })
      
      // Bulk delete
      .addCase(bulkDeleteContracts.fulfilled, (state, action) => {
        state.contracts = state.contracts.filter(c => !action.payload.includes(c._id));
        state.totalCount -= action.payload.length;
      });
  },
});

export const {
  setFilters,
  setCurrentPage,
  clearError,
  updateContractInList,
} = contractSlice.actions;

export default contractSlice.reducer;