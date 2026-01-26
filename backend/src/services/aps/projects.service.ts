import axios from 'axios';
import {
  APSProject,
  APSProjectUser,
  APSRole,
  APSError,
  RateLimitError,
  AddUserToProjectParams,
  AddUserToProjectResult,
} from '../../types';
import logger from '../../utils/logger';
import { wait } from '../../utils/helpers';

/**
 * APS Projects and Users Management Service
 * Handles all BIM 360 / ACC API calls for projects and user management
 */
export class APSProjectsService {
  private readonly baseUrl = 'https://developer.api.autodesk.com';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  /**
   * Get user's ACC/BIM360 accounts (hubs)
   * Uses the Data Management API which works with data:read scope
   * @param accessToken - Valid access token
   * @returns Array of accounts the user has access to
   */
  async getUserAccounts(
    accessToken: string
  ): Promise<Array<{ id: string; name: string; region: string }>> {
    try {
      // Use Data Management API to get hubs (which represent ACC/BIM360 accounts)
      const response = await this.makeRequest<{
        data: Array<{
          id: string;
          attributes: { name: string; region: string };
        }>;
      }>('get', '/project/v1/hubs', accessToken);

      const hubs = response.data || [];

      // Filter for BIM 360 and ACC hubs only (exclude Fusion etc.)
      // BIM 360 hubs start with "b." and ACC hubs start with "b."
      const accHubs = hubs
        .filter(hub => hub.id.startsWith('b.'))
        .map(hub => ({
          // Extract account ID from hub ID (remove "b." prefix)
          id: hub.id.substring(2),
          name: hub.attributes.name,
          region: hub.attributes.region || 'US',
        }));

      logger.info(`Retrieved ${accHubs.length} ACC/BIM360 hubs for user`);
      return accHubs;
    } catch (error) {
      logger.error('Failed to get user accounts (hubs)', { error });
      return [];
    }
  }

  /**
   * Get all projects for an account using Data Management API
   * @param accessToken - Valid access token
   * @param accountId - ACC Account ID
   * @returns Array of projects
   */
  async getProjects(
    accessToken: string,
    accountId: string
  ): Promise<APSProject[]> {
    const allProjects: APSProject[] = [];
    // Hub ID is "b." + accountId
    const hubId = `b.${accountId}`;

    // Define response type for Data Management API
    interface DMProjectResponse {
      data: Array<{
        id: string;
        attributes: {
          name: string;
          scopes: string[];
          extension?: { data?: { projectType?: string } };
        };
      }>;
      links?: { next?: { href: string } };
    }

    try {
      // Use Data Management API to get projects
      let url: string | null = `/project/v1/hubs/${hubId}/projects`;

      while (url) {
        const response: DMProjectResponse = await this.makeRequest<DMProjectResponse>(
          'get',
          url,
          accessToken
        );

        const projects = (response.data || []).map((p: DMProjectResponse['data'][0]) => ({
          id: p.id.replace('b.', ''), // Remove "b." prefix from project ID
          name: p.attributes.name,
          accountId: accountId,
          status: 'active' as const,
          platform: p.attributes.extension?.data?.projectType || 'ACC',
        }));

        allProjects.push(...projects);

        // Check for pagination
        if (response.links?.next?.href) {
          // Extract path from full URL
          const nextUrlObj: URL = new URL(response.links.next.href);
          url = nextUrlObj.pathname + nextUrlObj.search;
        } else {
          url = null;
        }
      }

      logger.info(
        `Retrieved ${allProjects.length} projects for account ${accountId}`
      );
      return allProjects;
    } catch (error) {
      const errorDetails: Record<string, unknown> = { accountId, hubId };
      if (error instanceof APSError) {
        errorDetails.statusCode = error.statusCode;
        errorDetails.errorCode = error.errorCode;
        errorDetails.message = error.message;
        errorDetails.requestId = error.requestId;
      } else if (error instanceof Error) {
        errorDetails.message = error.message;
        errorDetails.stack = error.stack;
      }
      logger.error('Failed to get projects', errorDetails);
      throw error;
    }
  }

  /**
   * Get project by ID
   * @param accessToken - Valid access token
   * @param accountId - ACC Account ID
   * @param projectId - Project ID
   * @returns Project details
   */
  async getProject(
    accessToken: string,
    accountId: string,
    projectId: string
  ): Promise<APSProject> {
    try {
      const response = await this.makeRequest<APSProject>(
        'get',
        `/hq/v1/accounts/${accountId}/projects/${projectId}`,
        accessToken
      );

      return response;
    } catch (error) {
      logger.error('Failed to get project', { accountId, projectId, error });
      throw error;
    }
  }

  /**
   * Get users in a project
   * @param accessToken - Valid access token
   * @param accountId - ACC Account ID
   * @param projectId - Project ID
   * @returns Array of project users
   */
  async getProjectUsers(
    accessToken: string,
    accountId: string,
    projectId: string
  ): Promise<APSProjectUser[]> {
    const allUsers: APSProjectUser[] = [];
    let offset = 0;
    const limit = 100;

    try {
      while (true) {
        const response = await this.makeRequest<{ results: APSProjectUser[] }>(
          'get',
          `/hq/v1/accounts/${accountId}/projects/${projectId}/users`,
          accessToken,
          { params: { limit, offset } }
        );

        const users = response.results || [];
        allUsers.push(...users);

        if (users.length < limit) {
          break;
        }

        offset += limit;
      }

      logger.info(
        `Retrieved ${allUsers.length} users for project ${projectId}`
      );
      return allUsers;
    } catch (error) {
      logger.error('Failed to get project users', {
        accountId,
        projectId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get available roles in a project
   * @param accessToken - Valid access token
   * @param accountId - ACC Account ID
   * @param projectId - Project ID
   * @returns Array of roles
   */
  async getProjectRoles(
    accessToken: string,
    accountId: string,
    projectId: string
  ): Promise<APSRole[]> {
    try {
      const response = await this.makeRequest<APSRole[]>(
        'get',
        `/hq/v1/accounts/${accountId}/projects/${projectId}/industry_roles`,
        accessToken
      );

      logger.info(`Retrieved roles for project ${projectId}`);
      return response;
    } catch (error) {
      logger.error('Failed to get project roles', {
        accountId,
        projectId,
        error,
      });
      throw error;
    }
  }

  /**
   * Check if user exists in project
   * @param accessToken - Valid access token
   * @param accountId - ACC Account ID
   * @param projectId - Project ID
   * @param email - User email
   * @returns User if exists, null otherwise
   */
  async checkUserInProject(
    accessToken: string,
    accountId: string,
    projectId: string,
    email: string
  ): Promise<APSProjectUser | null> {
    try {
      const users = await this.getProjectUsers(
        accessToken,
        accountId,
        projectId
      );
      return (
        users.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        ) || null
      );
    } catch (error) {
      logger.error('Failed to check user in project', {
        accountId,
        projectId,
        email,
        error,
      });
      return null;
    }
  }

  /**
   * Add user to project with specified role
   * @param params - Parameters for adding user
   * @returns Result of the operation
   */
  async addUserToProject(
    params: AddUserToProjectParams
  ): Promise<AddUserToProjectResult> {
    const { accountId, projectId, email, role, accessToken } = params;

    try {
      // First, check if user already exists in project
      const existingUser = await this.checkUserInProject(
        accessToken,
        accountId,
        projectId,
        email
      );

      if (existingUser) {
        logger.info(`User ${email} already exists in project ${projectId}`);

        // Check if role needs to be updated
        const hasRole = existingUser.roleIds.includes(role);

        if (hasRole) {
          return {
            success: true,
            userId: existingUser.id,
          };
        }

        // Update user role
        return await this.updateUserRole(
          accessToken,
          accountId,
          projectId,
          existingUser.id,
          role
        );
      }

      // User doesn't exist, add them
      const response = await this.makeRequest<{ id: string }>(
        'post',
        `/hq/v1/accounts/${accountId}/projects/${projectId}/users`,
        accessToken,
        {
          data: {
            email,
            products: [
              {
                key: 'projectAdministration',
                access: 'administrator',
              },
            ],
            industryRoles: [role],
          },
        }
      );

      logger.info(`Successfully added user ${email} to project ${projectId}`);

      return {
        success: true,
        userId: response.id,
      };
    } catch (error) {
      return this.handleUserOperationError(error, email, projectId);
    }
  }

  /**
   * Update user role in project
   */
  private async updateUserRole(
    accessToken: string,
    accountId: string,
    projectId: string,
    userId: string,
    role: string
  ): Promise<AddUserToProjectResult> {
    try {
      await this.makeRequest(
        'patch',
        `/hq/v1/accounts/${accountId}/projects/${projectId}/users/${userId}`,
        accessToken,
        {
          data: {
            industryRoles: [role],
          },
        }
      );

      logger.info(
        `Successfully updated user ${userId} role in project ${projectId}`
      );

      return {
        success: true,
        userId,
      };
    } catch (error) {
      return this.handleUserOperationError(error, userId, projectId);
    }
  }

  /**
   * Remove user from project
   * @param accessToken - Valid access token
   * @param accountId - ACC Account ID
   * @param projectId - Project ID
   * @param userId - User ID to remove
   */
  async removeUserFromProject(
    accessToken: string,
    accountId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    try {
      await this.makeRequest(
        'delete',
        `/hq/v1/accounts/${accountId}/projects/${projectId}/users/${userId}`,
        accessToken
      );

      logger.info(
        `Successfully removed user ${userId} from project ${projectId}`
      );
    } catch (error) {
      logger.error('Failed to remove user from project', {
        accountId,
        projectId,
        userId,
        error,
      });
      throw error;
    }
  }

  /**
   * Generic API request handler with retry logic and rate limit handling
   */
  private async makeRequest<T>(
    method: 'get' | 'post' | 'patch' | 'delete',
    endpoint: string,
    accessToken: string,
    options: {
      params?: Record<string, any>;
      data?: Record<string, any>;
    } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios({
          method,
          url,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          params: options.params,
          data: options.data,
        });

        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status;

          // Handle rate limiting
          if (statusCode === 429) {
            const retryAfter =
              parseInt(error.response?.headers['retry-after'] || '60') * 1000;

            logger.warn(`Rate limited on ${endpoint}, retrying after ${retryAfter}ms`);

            if (attempt < this.maxRetries) {
              await wait(retryAfter);
              continue;
            }

            throw new RateLimitError(
              'Rate limit exceeded',
              retryAfter,
              error.response?.headers['x-ads-request-id']
            );
          }

          // Retry on 5xx errors
          if (statusCode && statusCode >= 500 && attempt < this.maxRetries) {
            logger.warn(
              `Server error ${statusCode} on ${endpoint}, attempt ${attempt}/${this.maxRetries}`
            );
            await wait(this.retryDelay * attempt);
            continue;
          }

          // Don't retry on 4xx errors (except 429)
          throw new APSError(
            error.response?.data?.detail || error.message,
            statusCode || 500,
            error.response?.data?.code,
            error.response?.headers['x-ads-request-id']
          );
        }

        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Handle errors from user operations
   */
  private handleUserOperationError(
    error: unknown,
    userIdentifier: string,
    projectId: string
  ): AddUserToProjectResult {
    if (error instanceof APSError) {
      logger.error('User operation failed', {
        userIdentifier,
        projectId,
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        message: error.message,
      });

      return {
        success: false,
        errorCode: error.errorCode,
        errorMessage: error.message,
        apiRequestId: error.requestId,
      };
    }

    logger.error('Unexpected error in user operation', {
      userIdentifier,
      projectId,
      error,
    });

    return {
      success: false,
      errorMessage: 'An unexpected error occurred',
    };
  }
}

export default new APSProjectsService();
