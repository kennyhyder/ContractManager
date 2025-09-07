import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  fetchContracts,
  fetchContract,
  createContract,
  updateContract,
  deleteContract,
  updateContractStatus,
} from '../store/contractSlice';

export function useContract() {
  const dispatch = useDispatch();
  const { contracts, currentContract, loading, error } = useSelector(
    (state) => state.contracts
  );

  const loadContracts = useCallback(async (params = {}) => {
    try {
      await dispatch(fetchContracts(params)).unwrap();
    } catch (error) {
      toast.error('Failed to load contracts');
    }
  }, [dispatch]);

  const loadContract = useCallback(async (id) => {
    try {
      await dispatch(fetchContract(id)).unwrap();
    } catch (error) {
      toast.error('Failed to load contract');
    }
  }, [dispatch]);

  const create = useCallback(async (contractData) => {
    try {
      const result = await dispatch(createContract(contractData)).unwrap();
      toast.success('Contract created successfully');
      return result;
    } catch (error) {
      toast.error(error.message || 'Failed to create contract');
      throw error;
    }
  }, [dispatch]);

  const update = useCallback(async (id, contractData) => {
    try {
      const result = await dispatch(updateContract({ id, data: contractData })).unwrap();
      toast.success('Contract updated successfully');
      return result;
    } catch (error) {
      toast.error(error.message || 'Failed to update contract');
      throw error;
    }
  }, [dispatch]);

  const remove = useCallback(async (id) => {
    try {
      await dispatch(deleteContract(id)).unwrap();
      toast.success('Contract deleted successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to delete contract');
      throw error;
    }
  }, [dispatch]);

  const changeStatus = useCallback(async (id, status) => {
    try {
      await dispatch(updateContractStatus({ id, status })).unwrap();
      toast.success(`Contract ${status} successfully`);
    } catch (error) {
      toast.error(error.message || 'Failed to update contract status');
      throw error;
    }
  }, [dispatch]);

  const signContract = useCallback(async (id, signatureData) => {
    try {
      const response = await fetch(`/api/contracts/${id}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(signatureData),
      });

      if (!response.ok) throw new Error('Failed to sign contract');

      const result = await response.json();
      toast.success('Contract signed successfully');
      return result;
    } catch (error) {
      toast.error(error.message || 'Failed to sign contract');
      throw error;
    }
  }, []);

  return {
    contracts,
    currentContract,
    loading,
    error,
    loadContracts,
    loadContract,
    createContract: create,
    updateContract: update,
    deleteContract: remove,
    updateStatus: changeStatus,
    signContract,
  };
}