// Core TypeScript type definitions for ACC User Manager

// ============================================================================
// APS/ACC API Types
// ============================================================================

export interface APSTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface APSUserProfile {
  userId: string;
  userName: string;
  emailId: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  '2FaEnabled': boolean;
  countryCode: string;
}

export interface APSAccount {
  id: string;
  name: string;
  accountId: string;
}

export interface APSProject {
  id: string;
  name: string;
  accountId: string;
  platform: string;
  status: string;
  jobNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  country?: string;
  businessUnit?: string;
  timezone?: string;
  language?: string;
  constructionType?: string;
  deliveryMethod?: string;
  contractType?: string;
  currentPhase?: string;
  startDate?: string;
  endDate?: string;
}

export interface APSUser {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  autodeskId?: string;
  status?: string;
}

export interface APSProjectUser {
  id: string;
  email: string;
  name: string;
  autodeskId: string;
  companyId?: string;
  companyName?: string;
  roleIds: string[];
  products: {
    key: string;
    access: string;
  }[];
}

export interface APSRole {
  id: string;
  name: string;
  description?: string;
  memberGroupId?: string;
}

// ============================================================================
// Database Models
// ============================================================================

export interface User {
  id: string;
  apsUserId: string;
  email: string;
  name: string | null;
  accountId: string | null;
  isAccountAdmin: boolean;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  accountId: string;
  projectId: string;
  projectName: string;
  projectType: string | null;
  status: string | null;
  region: string | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'partial_success'
  | 'failed'
  | 'cancelled';

export interface JobExecution {
  id: string;
  userId: string | null;
  jobType: string;
  status: JobStatus;
  targetUserEmails: string[];
  targetProjectIds: string[];
  assignedRole: string;
  totalProjects: number;
  completedCount: number;
  successCount: number;
  failedCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedDurationSeconds: number | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ResultStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'skipped'
  | 'failed';

export interface JobResult {
  id: string;
  executionId: string;
  projectId: string;
  projectName: string | null;
  userEmail: string;
  status: ResultStatus;
  previousRole: string | null;
  assignedRole: string | null;
  actionTaken: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  apiRequestId: string | null;
  apiResponseCode: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AuditAction =
  | 'user_login'
  | 'user_logout'
  | 'projects_fetched'
  | 'user_preview'
  | 'job_created'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'user_added_to_project'
  | 'user_role_updated'
  | 'api_error'
  | 'rate_limit_hit';

export interface AuditLog {
  id: string;
  userId: string | null;
  executionId: string | null;
  action: AuditAction;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
}

// ============================================================================
// Application DTOs
// ============================================================================

export interface BulkUserAssignmentRequest {
  userEmails: string[];
  projectIds: string[];
  role: string;
  accountId: string;
}

export interface PreviewRequest {
  userEmails: string[];
  projectIds: string[];
  accountId: string;
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

export interface JobStatusResponse {
  id: string;
  status: JobStatus;
  progress: {
    total: number;
    completed: number;
    success: number;
    failed: number;
    percentage: number;
  };
  results: JobResult[];
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedTimeRemaining: number | null;
}

// ============================================================================
// Service Layer Types
// ============================================================================

export interface APSClientConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  baseUrl: string;
}

export interface APSAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  userProfile: APSUserProfile;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

export interface AddUserToProjectParams {
  accountId: string;
  projectId: string;
  email: string;
  role: string;
  accessToken: string;
  adminUserId?: string;
}

export interface AddUserToProjectResult {
  success: boolean;
  userId?: string;
  errorCode?: string;
  errorMessage?: string;
  apiRequestId?: string;
}

// ============================================================================
// Job Queue Types
// ============================================================================

export interface BulkAssignmentJobData {
  executionId: string;
  userId: string;
  accountId: string;
  userEmails: string[];
  projectIds: string[];
  role: string;
  accessToken: string;
  adminUserId?: string;
}

export interface ProjectAssignmentTask {
  executionId: string;
  projectId: string;
  projectName: string;
  userEmail: string;
  role: string;
  accountId: string;
  accessToken: string;
  adminUserId?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class APSError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
    public requestId?: string
  ) {
    super(message);
    this.name = 'APSError';
  }
}

export class RateLimitError extends APSError {
  constructor(
    message: string,
    public retryAfter: number,
    requestId?: string
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', requestId);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// ============================================================================
// Express Session Types
// ============================================================================

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    apsUserId?: string;
    email?: string;
    accountId?: string;
    isAccountAdmin?: boolean;
    oauthState?: string;
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  aps: APSClientConfig;
  database: {
    url: string;
    poolMin: number;
    poolMax: number;
  };
  redis: {
    url: string;
    password?: string;
  };
  session: {
    secret: string;
    maxAge: number;
  };
  security: {
    encryptionKey: string;
    corsOrigin: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  queue: {
    concurrency: number;
    jobTimeoutMs: number;
    maxRetries: number;
  };
}
