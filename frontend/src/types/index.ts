// Frontend Type Definitions

export interface User {
  id: string;
  apsUserId: string;
  email: string;
  name: string | null;
  accountId: string | null;
  isAccountAdmin: boolean;
}

export interface Project {
  id: string;
  name: string;
  status: string;
  platform: string;
}

export interface ProjectUser {
  id: string;
  email: string;
  name: string;
  roleIds: string[];
  companyName?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface AccountMember {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

// Access levels for ACC project users
export type AccessLevel = 'admin' | 'user';

export interface AccessLevelOption {
  value: AccessLevel;
  label: string;
  description: string;
}

export interface PreviewResult {
  userEmail: string;
  projectId: string;
  projectName: string;
  currentAccess: {
    hasAccess: boolean;
    currentRole?: string;
  };
  willBeAdded: boolean;
  willBeUpdated: boolean;
}

export interface PreviewSummary {
  totalOperations: number;
  newUsers: number;
  updates: number;
}

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'partial_success'
  | 'failed'
  | 'cancelled';

export type ResultStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'skipped'
  | 'failed';

export interface JobProgress {
  total: number;
  completed: number;
  success: number;
  failed: number;
  percentage: number;
}

export interface JobResult {
  id: string;
  projectId: string;
  projectName: string | null;
  userEmail: string;
  status: ResultStatus;
  previousRole: string | null;
  assignedRole: string | null;
  actionTaken: string | null;
  errorMessage: string | null;
  completedAt: Date | null;
}

export interface JobExecution {
  id: string;
  status: JobStatus;
  progress: JobProgress;
  results: JobResult[];
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedTimeRemaining: number | null;
}

export interface JobHistoryItem {
  id: string;
  status: JobStatus;
  totalProjects: number;
  successCount: number;
  failedCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

// API Request/Response types

export interface BulkAssignmentRequest {
  userEmails: string[];
  projectIds: string[];
  role: string;
}

export interface BulkAssignmentResponse {
  executionId: string;
  status: string;
  totalProjects: number;
  message: string;
}

export interface PreviewRequest {
  userEmails: string[];
  projectIds: string[];
}

export interface PreviewResponse {
  preview: PreviewResult[];
  summary: PreviewSummary;
}

// UI State types

export interface BulkAssignmentFormData {
  selectedProjects: string[];
  userEmails: string;
  selectedMembers: string[]; // Member IDs from ACC
  selectedRole: string;
  accessLevel: AccessLevel;
}

export interface AlertMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}
