import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchContracts, deleteContract } from '../../store/contractSlice';
import Loading from '../common/Loading';
import './ContractList.css';

function ContractList() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { contracts, loading, error, totalPages, currentPage } = useSelector(
    (state) => state.contracts
  );
  const { user } = useSelector((state) => state.auth);

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    type: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [selectedContracts, setSelectedContracts] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    loadContracts();
  }, [filters, currentPage]);

  const loadContracts = useCallback(() => {
    dispatch(fetchContracts({ ...filters, page: currentPage }));
  }, [dispatch, filters, currentPage]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadContracts();
  };

  const handleSort = (field) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleSelectContract = (contractId) => {
    setSelectedContracts((prev) =>
      prev.includes(contractId)
        ? prev.filter((id) => id !== contractId)
        : [...prev, contractId]
    );
  };

  const handleSelectAll = () => {
    if (selectedContracts.length === contracts.length) {
      setSelectedContracts([]);
    } else {
      setSelectedContracts(contracts.map((c) => c._id));
    }
  };

  const handleDeleteContract = async (contractId) => {
    if (window.confirm('Are you sure you want to delete this contract?')) {
      try {
        await dispatch(deleteContract(contractId)).unwrap();
        toast.success('Contract deleted successfully');
        loadContracts();
      } catch (error) {
        toast.error(error.message || 'Failed to delete contract');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedContracts.length} contracts?`)) {
      try {
        await Promise.all(
          selectedContracts.map((id) => dispatch(deleteContract(id)).unwrap())
        );
        toast.success(`${selectedContracts.length} contracts deleted successfully`);
        setSelectedContracts([]);
        loadContracts();
      } catch (error) {
        toast.error('Failed to delete some contracts');
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'gray',
      pending: 'yellow',
      approved: 'green',
      rejected: 'red',
      signed: 'blue',
      expired: 'orange',
    };
    return colors[status] || 'gray';
  };

  if (loading && contracts.length === 0) {
    return <Loading fullscreen />;
  }

  return (
    <div className="contract-list-container">
      <div className="page-header">
        <h1>Contracts</h1>
        <div className="header-actions">
          {selectedContracts.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={handleBulkDelete}
            >
              Delete ({selectedContracts.length})
            </button>
          )}
          <Link to="/contracts/new" className="btn btn-primary">
            <span>➕</span> New Contract
          </Link>
        </div>
      </div>

      <div className="filters-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="search"
            placeholder="Search contracts..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">
            Search
          </button>
        </form>

        <div className="filter-controls">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="signed">Signed</option>
            <option value="expired">Expired</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="filter-select"
          >
            <option value="">All Types</option>
            <option value="nda">NDA</option>
            <option value="service">Service Agreement</option>
            <option value="purchase">Purchase Agreement</option>
            <option value="employment">Employment</option>
            <option value="lease">Lease</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadContracts}>Retry</button>
        </div>
      )}

      <div className="contracts-table-container">
        <table className="contracts-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectedContracts.length === contracts.length && contracts.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th onClick={() => handleSort('title')} className="sortable">
                Title {filters.sortBy === 'title' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('type')} className="sortable">
                Type {filters.sortBy === 'type' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('parties')} className="sortable">
                Parties
              </th>
              <th onClick={() => handleSort('value')} className="sortable">
                Value {filters.sortBy === 'value' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('status')} className="sortable">
                Status {filters.sortBy === 'status' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('createdAt')} className="sortable">
                Created {filters.sortBy === 'createdAt' && (filters.sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract._id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedContracts.includes(contract._id)}
                    onChange={() => handleSelectContract(contract._id)}
                  />
                </td>
                <td>
                  <Link to={`/contracts/${contract._id}`} className="contract-title">
                    {contract.title}
                  </Link>
                </td>
                <td>
                  <span className="contract-type">{contract.type}</span>
                </td>
                <td>
                  <div className="parties-list">
                    {contract.parties?.slice(0, 2).map((party, index) => (
                      <span key={index} className="party-name">
                        {party.name}
                      </span>
                    ))}
                    {contract.parties?.length > 2 && (
                      <span className="more-parties">+{contract.parties.length - 2} more</span>
                    )}
                  </div>
                </td>
                <td>
                  {contract.value && (
                    <span className="contract-value">
                      ${contract.value.toLocaleString()}
                    </span>
                  )}
                </td>
                <td>
                  <span
                    className={`status-badge status-${getStatusColor(contract.status)}`}
                  >
                    {contract.status}
                  </span>
                </td>
                <td>
                  <span className="date">
                    {new Date(contract.createdAt).toLocaleDateString()}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <Link
                      to={`/contracts/${contract._id}`}
                      className="action-button"
                      title="View"
                    >
                      👁️
                    </Link>
                    {(user?.role === 'admin' || contract.createdBy === user?._id) && (
                      <>
                        <Link
                          to={`/contracts/${contract._id}/edit`}
                          className="action-button"
                          title="Edit"
                        >
                          ✏️
                        </Link>
                        <button
                          onClick={() => handleDeleteContract(contract._id)}
                          className="action-button danger"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {contracts.length === 0 && !loading && (
          <div className="empty-state">
            <p>No contracts found</p>
            <Link to="/contracts/new" className="btn btn-primary">
              Create your first contract
            </Link>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => dispatch(setCurrentPage(currentPage - 1))}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => dispatch(setCurrentPage(currentPage + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default ContractList;