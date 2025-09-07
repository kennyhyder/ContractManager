/**
 * Contract Management System TypeScript SDK
 * 
 * @module contract-management-sdk
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  Contract, 
  ContractCreateInput, 
  ContractUpdateInput,
  Template,
  TemplateCreateInput,
  User,
  LoginCredentials,
  AuthTokens,
  PaginatedResponse,
  ApiError,
  ContractFilters,
  Comment,
  CommentCreateInput,
  Approval,
  ApprovalAction
} from './types';

export interface SDKConfig {
  baseURL: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  onTokenRefresh?: (tokens: AuthTokens) => void;
}

export class ContractManagementSDK {
  private client: AxiosInstance;
  private config: SDKConfig;
  private accessToken?: string;
  private refreshToken?: string;

  constructor(config: SDKConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-API-Key': config.apiKey })
      }
    });

    this.setupInterceptors();
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (this.refreshToken) {
            try {
              const tokens = await this.refreshAccessToken();
              this.setTokens(tokens);
              originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
              return this.client(originalRequest);
            } catch (refreshError) {
              this.clearTokens();
              throw refreshError;
            }
          }
        }

        throw this.handleError(error);
      }
    );
  }

  /**
   * Handle API errors
   */
  private handleError(error: any): ApiError {
    if (error.response) {
      return {
        code: error.response.data?.code || 'API_ERROR',
        message: error.response.data?.message || 'An error occurred',
        statusCode: error.response.status,
        details: error.response.data?.details
      };
    } else if (error.request) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        statusCode: 0
      };
    } else {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred',
        statusCode: 0
      };
    }
  }

  /**
   * Set authentication tokens
   */
  public setTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    
    if (this.config.onTokenRefresh) {
      this.config.onTokenRefresh(tokens);
    }
  }

  /**
   * Clear authentication tokens
   */
  public clearTokens(): void {
    this.accessToken = undefined;
    this.refreshToken = undefined;
  }

  /**
   * Authentication Methods
   */
  
  async login(credentials: LoginCredentials): Promise<AuthTokens & { user: User }> {
    const response = await this.client.post<AuthTokens & { user: User }>(
      '/auth/login',
      credentials
    );
    
    const data = response.data;
    this.setTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    });
    
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      this.clearTokens();
    }
  }

  async refreshAccessToken(): Promise<AuthTokens> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.client.post<AuthTokens>('/auth/refresh', {
      refreshToken: this.refreshToken
    });

    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/users/me');
    return response.data;
  }

  /**
   * Contract Methods
   */

  async getContracts(
    filters?: ContractFilters
  ): Promise<PaginatedResponse<Contract>> {
    const response = await this.client.get<PaginatedResponse<Contract>>(
      '/contracts',
      { params: filters }
    );
    return response.data;
  }

  async getContract(id: string): Promise<Contract> {
    const response = await this.client.get<Contract>(`/contracts/${id}`);
    return response.data;
  }

  async createContract(data: ContractCreateInput): Promise<Contract> {
    const response = await this.client.post<Contract>('/contracts', data);
    return response.data;
  }

  async updateContract(
    id: string,
    data: ContractUpdateInput
  ): Promise<Contract> {
    const response = await this.client.put<Contract>(`/contracts/${id}`, data);
    return response.data;
  }

  async deleteContract(id: string): Promise<void> {
    await this.client.delete(`/contracts/${id}`);
  }

  async getContractVersions(id: string): Promise<any[]> {
    const response = await this.client.get(`/contracts/${id}/versions`);
    return response.data;
  }

  async compareContractVersions(
    id: string,
    version1: number,
    version2: number
  ): Promise<any> {
    const response = await this.client.post(`/contracts/${id}/compare`, {
      version1,
      version2
    });
    return response.data;
  }

  /**
   * Contract Actions
   */

  async submitForApproval(
    contractId: string,
    approvers: string[],
    message?: string
  ): Promise<Approval> {
    const response = await this.client.post<Approval>(
      `/contracts/${contractId}/submit-approval`,
      { approvers, message }
    );
    return response.data;
  }

  async approveContract(
    contractId: string,
    comments?: string
  ): Promise<Contract> {
    const response = await this.client.post<Contract>(
      `/contracts/${contractId}/approve`,
      { comments }
    );
    return response.data;
  }

  async rejectContract(
    contractId: string,
    reason: string
  ): Promise<Contract> {
    const response = await this.client.post<Contract>(
      `/contracts/${contractId}/reject`,
      { reason }
    );
    return response.data;
  }

  async signContract(
    contractId: string,
    signatureData: any
  ): Promise<Contract> {
    const response = await this.client.post<Contract>(
      `/contracts/${contractId}/sign`,
      signatureData
    );
    return response.data;
  }

  /**
   * Comment Methods
   */

  async getContractComments(contractId: string): Promise<Comment[]> {
    const response = await this.client.get<Comment[]>(
      `/contracts/${contractId}/comments`
    );
    return response.data;
  }

  async addComment(
    contractId: string,
    data: CommentCreateInput
  ): Promise<Comment> {
    const response = await this.client.post<Comment>(
      `/contracts/${contractId}/comments`,
      data
    );
    return response.data;
  }

  async updateComment(
    contractId: string,
    commentId: string,
    content: string
  ): Promise<Comment> {
    const response = await this.client.put<Comment>(
      `/contracts/${contractId}/comments/${commentId}`,
      { content }
    );
    return response.data;
  }

  async deleteComment(
    contractId: string,
    commentId: string
  ): Promise<void> {
    await this.client.delete(
      `/contracts/${contractId}/comments/${commentId}`
    );
  }

  /**
   * Template Methods
   */

  async getTemplates(filters?: any): Promise<PaginatedResponse<Template>> {
    const response = await this.client.get<PaginatedResponse<Template>>(
      '/templates',
      { params: filters }
    );
    return response.data;
  }

  async getTemplate(id: string): Promise<Template> {
    const response = await this.client.get<Template>(`/templates/${id}`);
    return response.data;
  }

  async createTemplate(data: TemplateCreateInput): Promise<Template> {
    const response = await this.client.post<Template>('/templates', data);
    return response.data;
  }

  async updateTemplate(
    id: string,
    data: Partial<TemplateCreateInput>
  ): Promise<Template> {
    const response = await this.client.put<Template>(`/templates/${id}`, data);
    return response.data;
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.client.delete(`/templates/${id}`);
  }

  /**
   * File Upload Methods
   */

  async uploadAttachment(
    contractId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post(
      `/contracts/${contractId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(progress);
          }
        }
      }
    );

    return response.data;
  }

  async downloadAttachment(
    contractId: string,
    attachmentId: string
  ): Promise<Blob> {
    const response = await this.client.get(
      `/contracts/${contractId}/attachments/${attachmentId}`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  /**
   * WebSocket Connection
   */

  connectWebSocket(
    onMessage: (event: any) => void,
    onError?: (error: any) => void
  ): WebSocket {
    const wsUrl = this.config.baseURL.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (this.accessToken) {
        ws.send(JSON.stringify({
          type: 'auth',
          token: this.accessToken
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      if (onError) {
        onError(error);
      }
    };

    return ws;
  }

  /**
   * Analytics Methods
   */

  async getDashboardAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    const response = await this.client.get('/analytics/dashboard', {
      params: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      }
    });
    return response.data;
  }

  async getContractAnalytics(contractId: string): Promise<any> {
    const response = await this.client.get(`/analytics/contracts/${contractId}`);
    return response.data;
  }

  /**
   * Utility Methods
   */

  async exportContract(
    contractId: string,
    format: 'pdf' | 'docx' = 'pdf'
  ): Promise<Blob> {
    const response = await this.client.get(
      `/contracts/${contractId}/export`,
      {
        params: { format },
        responseType: 'blob'
      }
    );
    return response.data;
  }

  async searchContracts(query: string): Promise<Contract[]> {
    const response = await this.client.get<Contract[]>('/contracts/search', {
      params: { q: query }
    });
    return response.data;
  }

  async bulkUpdateContracts(
    contractIds: string[],
    updates: Partial<ContractUpdateInput>
  ): Promise<Contract[]> {
    const response = await this.client.post<Contract[]>(
      '/contracts/bulk-update',
      { contractIds, updates }
    );
    return response.data;
  }
}

// Export a factory function for easier instantiation
export function createClient(config: SDKConfig): ContractManagementSDK {
  return new ContractManagementSDK(config);
}

// Export all types
export * from './types';