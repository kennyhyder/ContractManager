// tests/frontend/unit/components/ContractForm.test.js
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import configureStore from 'redux-mock-store';
import ContractForm from '../../../../frontend/src/components/contracts/ContractForm';
import * as api from '../../../../frontend/src/services/api';

jest.mock('../../../../frontend/src/services/api');

const mockStore = configureStore([]);

describe('ContractForm Component', () => {
  let store;
  let user;

  beforeEach(() => {
    store = mockStore({
      auth: {
        user: { id: '1', email: 'test@example.com', role: 'user' },
        token: 'test-token'
      },
      ui: {
        loading: false,
        error: null
      }
    });
    user = userEvent.setup();
  });

  const renderComponent = (props = {}) => {
    return render(
      <Provider store={store}>
        <BrowserRouter>
          <ContractForm {...props} />
        </BrowserRouter>
      </Provider>
    );
  };

  describe('Create Mode', () => {
    it('should render empty form in create mode', () => {
      renderComponent();

      expect(screen.getByLabelText('Contract Title')).toHaveValue('');
      expect(screen.getByLabelText('Client Name')).toHaveValue('');
      expect(screen.getByLabelText('Client Email')).toHaveValue('');
      expect(screen.getByLabelText('Contract Value')).toHaveValue('');
      expect(screen.getByText('Create Contract')).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      renderComponent();

      const submitButton = screen.getByText('Create Contract');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('Client name is required')).toBeInTheDocument();
      });
    });

    it('should submit form with valid data', async () => {
      api.createContract.mockResolvedValue({
        data: { _id: '123', title: 'New Contract' }
      });

      const onSuccess = jest.fn();
      renderComponent({ onSuccess });

      await user.type(screen.getByLabelText('Contract Title'), 'Test Contract');
      await user.type(screen.getByLabelText('Client Name'), 'Test Client');
      await user.type(screen.getByLabelText('Client Email'), 'client@test.com');
      await user.type(screen.getByLabelText('Contract Value'), '50000');
      
      const submitButton = screen.getByText('Create Contract');
      await user.click(submitButton);

      await waitFor(() => {
        expect(api.createContract).toHaveBeenCalledWith({
          title: 'Test Contract',
          clientName: 'Test Client',
          clientEmail: 'client@test.com',
          value: 50000,
          status: 'draft'
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Edit Mode', () => {
    const existingContract = {
      _id: '123',
      title: 'Existing Contract',
      clientName: 'Existing Client',
      clientEmail: 'existing@client.com',
      value: 100000,
      status: 'active',
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    };

    it('should populate form with existing data', () => {
      renderComponent({ contract: existingContract, mode: 'edit' });

      expect(screen.getByLabelText('Contract Title')).toHaveValue('Existing Contract');
      expect(screen.getByLabelText('Client Name')).toHaveValue('Existing Client');
      expect(screen.getByLabelText('Client Email')).toHaveValue('existing@client.com');
      expect(screen.getByLabelText('Contract Value')).toHaveValue('100000');
      expect(screen.getByText('Update Contract')).toBeInTheDocument();
    });

    it('should update contract', async () => {
      api.updateContract.mockResolvedValue({
        data: { ...existingContract, title: 'Updated Contract' }
      });

      const onSuccess = jest.fn();
      renderComponent({ contract: existingContract, mode: 'edit', onSuccess });

      const titleInput = screen.getByLabelText('Contract Title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Contract');

      await user.click(screen.getByText('Update Contract'));

      await waitFor(() => {
        expect(api.updateContract).toHaveBeenCalledWith('123', {
          title: 'Updated Contract',
          clientName: 'Existing Client',
          clientEmail: 'existing@client.com',
          value: 100000,
          status: 'active',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Advanced Features', () => {
    it('should handle file uploads', async () => {
      renderComponent();

      const file = new File(['contract content'], 'contract.pdf', {
        type: 'application/pdf'
      });

      const fileInput = screen.getByLabelText('Attach Document');
      await user.upload(fileInput, file);

      expect(fileInput.files[0]).toBe(file);
      expect(fileInput.files).toHaveLength(1);
    });

    it('should toggle template selection', async () => {
      api.getTemplates.mockResolvedValue({
        data: [
          { _id: 't1', name: 'NDA Template', content: 'NDA content' },
          { _id: 't2', name: 'Service Agreement', content: 'Service content' }
        ]
      });

      renderComponent();

      const templateCheckbox = screen.getByLabelText('Use Template');
      await user.click(templateCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Select Template')).toBeInTheDocument();
        expect(screen.getByText('NDA Template')).toBeInTheDocument();
        expect(screen.getByText('Service Agreement')).toBeInTheDocument();
      });

      await user.click(screen.getByText('NDA Template'));

      expect(screen.getByLabelText('Contract Content')).toHaveValue('NDA content');
    });

    it('should calculate expiry date based on duration', async () => {
      renderComponent();

      const startDateInput = screen.getByLabelText('Start Date');
      const durationInput = screen.getByLabelText('Duration (days)');

      await user.type(startDateInput, '2024-01-01');
      await user.type(durationInput, '365');

      await waitFor(() => {
        const endDateInput = screen.getByLabelText('End Date');
        expect(endDateInput).toHaveValue('2024-12-31');
      });
    });
  });

  describe('Validation', () => {
    it('should validate email format', async () => {
      renderComponent();

      const emailInput = screen.getByLabelText('Client Email');
      await user.type(emailInput, 'invalid-email');
      
      await user.click(screen.getByText('Create Contract'));

      await waitFor(() => {
        expect(screen.getByText('Invalid email format')).toBeInTheDocument();
      });
    });

    it('should validate contract value', async () => {
      renderComponent();

      const valueInput = screen.getByLabelText('Contract Value');
      await user.type(valueInput, '-1000');
      
      await user.click(screen.getByText('Create Contract'));

      await waitFor(() => {
        expect(screen.getByText('Value must be positive')).toBeInTheDocument();
      });
    });

    it('should validate date range', async () => {
      renderComponent();

      const startDate = screen.getByLabelText('Start Date');
      const endDate = screen.getByLabelText('End Date');

      await user.type(startDate, '2024-12-31');
      await user.type(endDate, '2024-01-01');
      
      await user.click(screen.getByText('Create Contract'));

      await waitFor(() => {
        expect(screen.getByText('End date must be after start date')).toBeInTheDocument();
      });
    });
  });
});