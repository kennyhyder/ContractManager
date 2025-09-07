/**
 * Type definitions for Contract Management System SDK
 */

/**
 * User types
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  company?: string;
  department?: string;
  avatar?: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'user' | 'manager' | 'admin' | 'super_admin';

export interface LoginCredentials {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Contract types
 */
export interface Contract {
  id: string;
  title: string;
  description?: string;
  type: ContractType;
  status: ContractStatus;
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  content?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  version: number;
  isTemplate: boolean;
  createdBy: string;
  templateId?: string;
  parties: Party[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type ContractType = 
  | 'employment' 
  | 'service' 
  | 'nda' 
  | 'sales' 
  | 'lease' 
  | 'partnership' 
  | 'other';

export type ContractStatus = 
  | 'draft' 
  | 'pending_review' 
  | 'approved' 
  | 'active' 
  | 'expired' 
  | 'terminated' 
  | 'cancelled';

export interface ContractCreateInput {
  title: string;
  description?: string;
  type: ContractType;
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  content?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  templateId?: string;
  parties?: PartyCreateInput[];
}

export interface ContractUpdateInput {
  title?: string;
  description?: string;
  status?: ContractStatus;
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  content?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface ContractFilters {
  status?: ContractStatus;
  type?: ContractType;
  search?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Party types
 */
export interface Party {
  id: string;
  name: string;
  type: PartyType;
  email?: string;
  phone?: string;
  address?: string;
  role: PartyRole;
  signatureStatus: SignatureStatus;
  signedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PartyType = 'individual' | 'company' | 'organization';

export type PartyRole = 
  | 'client' 
  | 'vendor' 
  | 'employee' 
  | 'contractor' 
  | 'landlord' 
  | 'tenant' 
  | 'partner' 
  | 'other';

export type SignatureStatus = 'pending' | 'signed' | 'declined' | 'expired';

export interface PartyCreateInput {
  name: string;
  type: PartyType;
  email?: string;
  phone?: string;
  address?: string;
  role: PartyRole;
}

/**
 * Template types
 */
export interface Template {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  content: string;
  variables: TemplateVariable[];
  metadata?: Record<string, any>;
  tags?: string[];
  isPublic: boolean;
  isFeatured: boolean;
  price?: number;
  currency?: string;
  usageCount: number;
  rating?: number;
  ratingCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory = 
  | 'employment' 
  | 'service' 
  | 'nda' 
  | 'sales' 
  | 'lease' 
  | 'legal' 
  | 'other';

export interface TemplateVariable {
  name: string;
  type: VariableType;
  required?: boolean;
  defaultValue?: any;
  options?: string[];
  description?: string;
}

export type VariableType = 'text' | 'number' | 'date' | 'boolean' | 'select';

export interface TemplateCreateInput {
  name: string;
  description?: string;
  category: TemplateCategory;
  content: string;
  variables?: TemplateVariable[];
  metadata?: Record<string, any>;
  tags?: string[];
  isPublic?: boolean;
  price?: number;
  currency?: string;
}

/**
 * Comment types
 */
export interface Comment {
  id: string;
  contractId: string;
  userId: string;
  content: string;
  parentId?: string;
  position?: CommentPosition;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  mentions?: string[];
  attachments?: any[];
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CommentPosition {
  page?: number;
  x?: number;
  y?: number;
  selection?: string;
}

export interface CommentCreateInput {
  content: string;
  parentId?: string;
  position?: CommentPosition;
  mentions?: string[];
}

/**
 * Approval types
 */
export interface Approval {
  id: string;
  contractId: string;
  status: ApprovalStatus;
  currentStep: number;
  totalSteps: number;
  dueDate?: string;
  completedAt?: string;
  steps: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

export type ApprovalStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'approved' 
  | 'rejected' 
  | 'cancelled' 
  | 'expired';

export interface ApprovalStep {
  id: string;
  stepNumber: number;
  approverId: string;
  approver: {
    id: string;
    name: string;
    email: string;
  };
  status: ApprovalStepStatus;
  decision?: ApprovalDecision;
  comments?: string;
  decidedAt?: string;
  createdAt: string;
}

export type ApprovalStepStatus = 
  | 'pending' 
  | 'reviewing' 
  | 'approved' 
  | 'rejected' 
  | 'skipped';

export type ApprovalDecision = 'approve' | 'reject' | 'delegate';

export interface ApprovalAction {
  decision: ApprovalDecision;
  comments?: string;
  delegateTo?: string;
}

/**
 * Attachment types
 */
export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

/**
 * Common types
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}

export interface Activity {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  description?: string;
  userId: string;
  user: {
    id: string;
    name: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

/**
 * WebSocket event types
 */
export interface WebSocketEvent {
  type: WebSocketEventType;
  payload: any;
  timestamp: string;
}

export type WebSocketEventType = 
  | 'contract.created'
  | 'contract.updated'
  | 'contract.deleted'
  | 'contract.signed'
  | 'comment.added'
  | 'comment.updated'
  | 'comment.deleted'
  | 'approval.requested'
  | 'approval.completed'
  | 'user.joined'
  | 'user.left'
  | 'cursor.moved'
  | 'selection.changed';