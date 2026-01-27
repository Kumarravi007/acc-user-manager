import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  User,
  Project,
  Role,
  AccountMember,
  PreviewRequest,
  PreviewResponse,
  BulkAssignmentRequest,
  BulkAssignmentResponse,
  JobExecution,
  JobHistoryItem,
} from '@/types';

// Use relative URL to go through Next.js proxy (configured in next.config.js)
// This ensures cookies work properly (same-origin requests)
const API_BASE_URL = '';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Redirect to login if not authenticated (but not if already on login page)
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  async initiateLogin(): Promise<{ authUrl: string }> {
    const response = await this.client.get('/api/auth/login');
    return response.data;
  }

  async getCurrentUser(): Promise<{ user: User }> {
    const response = await this.client.get('/api/auth/me');
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/api/auth/logout');
  }

  // ============================================================================
  // Projects
  // ============================================================================

  async getProjects(): Promise<{ projects: Project[] }> {
    const response = await this.client.get('/api/projects');
    return response.data;
  }

  async getProject(projectId: string): Promise<{ project: Project }> {
    const response = await this.client.get(`/api/projects/${projectId}`);
    return response.data;
  }

  async getProjectUsers(projectId: string): Promise<{ users: any[] }> {
    const response = await this.client.get(`/api/projects/${projectId}/users`);
    return response.data;
  }

  async getProjectRoles(projectId: string): Promise<{ roles: Role[] }> {
    const response = await this.client.get(`/api/projects/${projectId}/roles`);
    return response.data;
  }

  // ============================================================================
  // Account
  // ============================================================================

  async getAccountMembers(): Promise<{ members: AccountMember[] }> {
    const response = await this.client.get('/api/account/members');
    return response.data;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  async previewBulkAssignment(
    data: PreviewRequest
  ): Promise<PreviewResponse> {
    const response = await this.client.post('/api/bulk/preview', data);
    return response.data;
  }

  async executeBulkAssignment(
    data: BulkAssignmentRequest
  ): Promise<BulkAssignmentResponse> {
    const response = await this.client.post('/api/bulk/assign', data);
    return response.data;
  }

  async getJobStatus(executionId: string): Promise<JobExecution> {
    const response = await this.client.get(`/api/bulk/status/${executionId}`);
    return response.data;
  }

  async getJobHistory(
    limit = 20,
    offset = 0
  ): Promise<{
    executions: JobHistoryItem[];
    pagination: { limit: number; offset: number; hasMore: boolean };
  }> {
    const response = await this.client.get('/api/bulk/history', {
      params: { limit, offset },
    });
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
