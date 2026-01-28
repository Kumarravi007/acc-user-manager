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
import apsAuthService from './auth.service';

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
   * Get all users/members in an account from ACC Admin API
   * Uses 2-legged OAuth (client credentials) which is required for Admin APIs
   * @param _accessToken - Not used, kept for API compatibility
   * @param accountId - ACC Account ID
   * @returns Array of account members
   */
  async getAccountUsers(
    _accessToken: string,
    accountId: string
  ): Promise<Array<{
    id: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    status: string;
    companyId?: string;
    companyName?: string;
  }>> {
    const allUsers: Array<{
      id: string;
      email: string;
      name: string;
      firstName?: string;
      lastName?: string;
      status: string;
      companyId?: string;
      companyName?: string;
    }> = [];
    let offset = 0;
    const limit = 100;

    logger.info(`Fetching account users for account ${accountId}`, {
      endpoint: `/hq/v1/accounts/${accountId}/users`,
      accountIdLength: accountId.length,
      authType: '2-legged',
    });

    try {
      // Get 2-legged token for Admin API (required for account-level operations)
      const twoLeggedToken = await apsAuthService.getTwoLeggedToken();

      while (true) {
        // Use HQ API endpoint to fetch account users
        // Endpoint: https://developer.api.autodesk.com/hq/v1/accounts/:account_id/users
        const response = await this.makeRequest<
          | Array<{
              id: string;
              email: string;
              name: string;
              first_name?: string;
              last_name?: string;
              status: string;
              company_id?: string;
              company_name?: string;
            }>
          | {
              results?: Array<{
                id: string;
                email: string;
                name: string;
                first_name?: string;
                last_name?: string;
                status: string;
                company_id?: string;
                company_name?: string;
              }>;
              pagination?: { limit: number; offset: number; totalResults: number };
            }
        >(
          'get',
          `/hq/v1/accounts/${accountId}/users`,
          twoLeggedToken,
          { params: { limit, offset } }
        );

        // Log raw response for debugging
        logger.info(`Users API response type: ${Array.isArray(response) ? 'array' : 'object'}`, {
          isArray: Array.isArray(response),
          hasResults: !Array.isArray(response) && 'results' in response,
          responseKeys: !Array.isArray(response) ? Object.keys(response) : 'N/A',
          firstItem: Array.isArray(response) ? response[0] : (response as any).results?.[0],
        });

        // Handle both array response and {results: [...]} response
        let rawUsers: Array<{
          id: string;
          email: string;
          name: string;
          first_name?: string;
          last_name?: string;
          status: string;
          company_id?: string;
          company_name?: string;
        }>;

        if (Array.isArray(response)) {
          rawUsers = response;
        } else {
          rawUsers = response.results || [];
        }

        const users = rawUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          firstName: u.first_name,
          lastName: u.last_name,
          status: u.status,
          companyId: u.company_id,
          companyName: u.company_name,
        }));

        allUsers.push(...users);

        if (users.length < limit) {
          break;
        }

        offset += limit;
      }

      logger.info(`Retrieved ${allUsers.length} users for account ${accountId}`);
      return allUsers;
    } catch (error) {
      const errorDetails: Record<string, unknown> = { accountId };
      if (error instanceof APSError) {
        errorDetails.statusCode = error.statusCode;
        errorDetails.errorCode = error.errorCode;
        errorDetails.message = error.message;
        errorDetails.requestId = error.requestId;

        // Provide more helpful error messages for common cases
        if (error.statusCode === 403) {
          logger.error('Permission denied for account members API. This usually means: 1) The APS app (Client ID) needs to be added to ACC Admin > Custom Integrations, or 2) The user is not an Account Admin.', errorDetails);
        } else if (error.statusCode === 404) {
          logger.error('Account not found or API endpoint not available for this account.', errorDetails);
        }
      } else if (error instanceof Error) {
        errorDetails.message = error.message;
        errorDetails.stack = error.stack;
      }
      logger.error('Failed to get account users', errorDetails);
      throw error;
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

        const projects = (response.data || [])
          // Filter out template projects
          .filter((p: DMProjectResponse['data'][0]) => {
            const scopes = p.attributes.scopes || [];
            const projectName = p.attributes.name || '';
            const projectType = p.attributes.extension?.data?.projectType || '';

            // Check multiple indicators for templates
            const isScopeTemplate = scopes.some(s => s.toLowerCase().includes('template'));
            const isNameTemplate = projectName.toLowerCase().includes('template');
            const isTypeTemplate = projectType.toLowerCase().includes('template');

            const isTemplate = isScopeTemplate || isNameTemplate || isTypeTemplate;

            if (isTemplate) {
              logger.debug(`Filtering out template project: ${projectName}`, { scopes, projectType });
            }

            return !isTemplate;
          })
          .map((p: DMProjectResponse['data'][0]) => ({
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
   * Get project by ID using Data Management API
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
    // Hub ID is "b." + accountId, Project ID also needs "b." prefix for Data Management API
    const hubId = `b.${accountId}`;
    const dmProjectId = projectId.startsWith('b.') ? projectId : `b.${projectId}`;

    try {
      // Use Data Management API to get project details (consistent with getProjects)
      const response = await this.makeRequest<{
        data: {
          id: string;
          attributes: {
            name: string;
            scopes: string[];
            extension?: { data?: { projectType?: string } };
          };
        };
      }>(
        'get',
        `/project/v1/hubs/${hubId}/projects/${dmProjectId}`,
        accessToken
      );

      const project = response.data;
      return {
        id: project.id.replace('b.', ''), // Remove "b." prefix from project ID
        name: project.attributes.name,
        accountId: accountId,
        status: 'active' as const,
        platform: project.attributes.extension?.data?.projectType || 'ACC',
      };
    } catch (error) {
      logger.error('Failed to get project', { accountId, projectId, hubId, dmProjectId, error });
      throw error;
    }
  }

  /**
   * Get users in a project
   * Uses 2-legged OAuth for ACC Admin API access
   * @param _accessToken - Not used, kept for API compatibility
   * @param accountId - ACC Account ID
   * @param projectId - Project ID
   * @returns Array of project users
   */
  async getProjectUsers(
    _accessToken: string,
    accountId: string,
    projectId: string
  ): Promise<APSProjectUser[]> {
    const allUsers: APSProjectUser[] = [];
    let offset = 0;
    const limit = 100;

    // ACC Admin API expects UUID without "b." prefix
    const cleanProjectId = projectId.replace('b.', '');

    try {
      // Get 2-legged token for Admin API (required for project users endpoint)
      const twoLeggedToken = await apsAuthService.getTwoLeggedToken();

      // Use ACC Admin API endpoint (more reliable than HQ API for ACC projects)
      // Endpoint: /construction/admin/v1/projects/{projectId}/users
      while (true) {
        const response = await this.makeRequest<{
          pagination?: { limit: number; offset: number; totalResults: number };
          results: Array<{
            id: string;
            email: string;
            name: string;
            firstName?: string;
            lastName?: string;
            autodeskId?: string;
            companyId?: string;
            companyName?: string;
            roleIds?: string[];
            roles?: Array<{ id: string; name: string }>;
            accessLevels?: { accountAdmin?: boolean; projectAdmin?: boolean };
            products?: Array<{ key: string; access: string }>;
          }>;
        }>(
          'get',
          `/construction/admin/v1/projects/${cleanProjectId}/users`,
          twoLeggedToken,
          { params: { limit, offset } }
        );

        const rawUsers = response.results || [];

        // Map to APSProjectUser format
        const users: APSProjectUser[] = rawUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          autodeskId: u.autodeskId || '',
          companyId: u.companyId,
          companyName: u.companyName,
          roleIds: u.roleIds || (u.roles?.map(r => r.id) || []),
          products: u.products || [],
        }));

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
   * Uses 2-legged OAuth for Admin API access
   * @param _accessToken - Not used, kept for API compatibility
   * @param accountId - ACC Account ID
   * @param projectId - Project ID
   * @returns Array of roles
   */
  async getProjectRoles(
    _accessToken: string,
    accountId: string,
    projectId: string
  ): Promise<APSRole[]> {
    try {
      logger.info(`Fetching roles for project ${projectId} in account ${accountId}`, {
        authType: '2-legged',
      });

      // Get 2-legged token for Admin API
      const twoLeggedToken = await apsAuthService.getTwoLeggedToken();

      const response = await this.makeRequest<APSRole[]>(
        'get',
        `/hq/v1/accounts/${accountId}/projects/${projectId}/industry_roles`,
        twoLeggedToken
      );

      logger.info(`Retrieved ${Array.isArray(response) ? response.length : 0} roles for project ${projectId}`);
      return response;
    } catch (error) {
      const errorDetails: Record<string, unknown> = { accountId, projectId };
      if (error instanceof APSError) {
        errorDetails.statusCode = error.statusCode;
        errorDetails.errorCode = error.errorCode;
        errorDetails.message = error.message;
        errorDetails.requestId = error.requestId;
      } else if (error instanceof Error) {
        errorDetails.message = error.message;
      }
      logger.error('Failed to get project roles', errorDetails);
      throw error;
    }
  }

  /**
   * Get available roles at account level (from Account Admin > Roles)
   * Uses 2-legged OAuth for Admin API access
   * @param _accessToken - Not used, kept for API compatibility
   * @param accountId - ACC Account ID
   * @returns Array of account-level industry roles
   */
  async getAccountRoles(
    _accessToken: string,
    accountId: string
  ): Promise<APSRole[]> {
    try {
      logger.info(`Fetching account roles for account ${accountId}`, {
        authType: '2-legged',
      });

      // Get 2-legged token for Admin API
      const twoLeggedToken = await apsAuthService.getTwoLeggedToken();

      // Use HQ API - this endpoint returns account-level roles
      const response = await this.makeRequest<APSRole[] | { results?: APSRole[] }>(
        'get',
        `/hq/v1/accounts/${accountId}/industry_roles`,
        twoLeggedToken
      );

      // Handle both array and object response formats
      let roles: APSRole[];
      if (Array.isArray(response)) {
        roles = response;
      } else if (response && typeof response === 'object' && 'results' in response) {
        roles = response.results || [];
      } else {
        logger.warn('Unexpected response format from industry_roles API', { response });
        roles = [];
      }

      logger.info(`Retrieved ${roles.length} roles for account ${accountId}`);
      return roles;
    } catch (error) {
      const errorDetails: Record<string, unknown> = { accountId };
      if (error instanceof APSError) {
        errorDetails.statusCode = error.statusCode;
        errorDetails.errorCode = error.errorCode;
        errorDetails.message = error.message;
      } else if (error instanceof Error) {
        errorDetails.message = error.message;
      }
      logger.error('Failed to get account roles', errorDetails);
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
   * Get companies from BIM 360 account
   * Used to get default company_id for adding users
   */
  private async getAccountCompanies(
    accountId: string
  ): Promise<Array<{ id: string; name: string }>> {
    try {
      const twoLeggedToken = await apsAuthService.getTwoLeggedToken();

      const response = await this.makeRequest<
        Array<{ id: string; name: string }> | { results?: Array<{ id: string; name: string }> }
      >(
        'get',
        `/hq/v1/accounts/${accountId}/companies`,
        twoLeggedToken
      );

      let companies: Array<{ id: string; name: string }>;
      if (Array.isArray(response)) {
        companies = response;
      } else {
        companies = response.results || [];
      }

      logger.info(`Retrieved ${companies.length} companies for account ${accountId}`);
      return companies;
    } catch (error) {
      logger.error('Failed to get account companies', { accountId, error });
      return [];
    }
  }

  /**
   * Look up user info from account members for BIM 360 project user assignment
   * Returns user_id, company_id, and whether user was found in account
   */
  private async getAccountUserInfo(
    accountId: string,
    email: string
  ): Promise<{ userId: string | null; companyId: string | null; foundInAccount: boolean }> {
    try {
      const users = await this.getAccountUsers('', accountId);
      logger.info(`Searching for ${email} in ${users.length} account members`);

      const user = users.find(
        (u) => u.email.toLowerCase() === email.toLowerCase()
      );

      if (user) {
        logger.info(`Found user ${email} in account members`, {
          userId: user.id,
          companyId: user.companyId,
          companyName: user.companyName,
        });

        // If user has a company_id, use it
        if (user.companyId) {
          return {
            userId: user.id,
            companyId: user.companyId,
            foundInAccount: true,
          };
        }

        // User found but has no company - get default company from account
        logger.warn(`User ${email} found in account but has no company_id - fetching default company`);
        const companies = await this.getAccountCompanies(accountId);
        if (companies.length > 0) {
          const defaultCompany = companies[0];
          logger.info(`Using default company for user ${email}`, {
            companyId: defaultCompany.id,
            companyName: defaultCompany.name,
          });
          return {
            userId: user.id,
            companyId: defaultCompany.id,
            foundInAccount: true,
          };
        }

        // No companies found - return without company_id
        logger.warn(`No companies found in account ${accountId} for user ${email}`);
        return {
          userId: user.id,
          companyId: null,
          foundInAccount: true,
        };
      }

      logger.warn(`User ${email} NOT found in account members`);

      // User not in account - try to get default company
      const companies = await this.getAccountCompanies(accountId);
      if (companies.length > 0) {
        const defaultCompany = companies[0];
        logger.info(`Will use default company for external user ${email}`, {
          companyId: defaultCompany.id,
          companyName: defaultCompany.name,
        });
        return {
          userId: null,
          companyId: defaultCompany.id,
          foundInAccount: false,
        };
      }

      logger.warn(`No companies found in account ${accountId}`);
      return { userId: null, companyId: null, foundInAccount: false };
    } catch (error) {
      logger.error('Failed to look up user info', { accountId, email, error });
      return { userId: null, companyId: null, foundInAccount: false };
    }
  }

  /**
   * Add user to project with specified role
   * Uses 2-legged OAuth for ACC Admin API access
   * @param params - Parameters for adding user
   * @returns Result of the operation
   */
  async addUserToProject(
    params: AddUserToProjectParams
  ): Promise<AddUserToProjectResult> {
    const { accountId, projectId, email, role } = params;

    // ACC Admin API expects UUID without "b." prefix
    const cleanProjectId = projectId.replace('b.', '');

    // Validate role is a valid UUID if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidRoleUuid = role && uuidRegex.test(role);

    logger.info(`Adding user ${email} to project`, {
      originalProjectId: projectId,
      cleanProjectId,
      accountId,
      role,
      isValidRoleUuid
    });

    try {
      // Get 2-legged token for Admin API (required for user management)
      const twoLeggedToken = await apsAuthService.getTwoLeggedToken();

      // First, check if user already exists in project
      const existingUser = await this.checkUserInProject(
        twoLeggedToken,
        accountId,
        cleanProjectId,
        email
      );

      if (existingUser) {
        logger.info(`User ${email} already exists in project ${cleanProjectId}`);

        // Check if role needs to be updated (only if valid role UUID)
        if (isValidRoleUuid) {
          const hasRole = existingUser.roleIds.includes(role);

          if (hasRole) {
            return {
              success: true,
              userId: existingUser.id,
            };
          }

          // Update user role
          return await this.updateUserRole(
            cleanProjectId,
            existingUser.id,
            role
          );
        }

        // User exists but no role to update
        return {
          success: true,
          userId: existingUser.id,
        };
      }

      // User doesn't exist, add them
      // Try ACC Admin API first, fall back to HQ API for BIM 360 projects
      let response: { id: string };

      try {
        // ACC Admin API expects: email, roleIds (optional), products (optional)
        const accRequestData: any = {
          email,
          products: [
            {
              key: 'projectAdministration',
              access: 'administrator',
            },
          ],
        };

        // Only include roleIds if it's a valid UUID
        if (isValidRoleUuid) {
          accRequestData.roleIds = [role];
        }

        logger.info(`Trying ACC Admin API for project ${cleanProjectId}`, { accRequestData });

        response = await this.makeRequest<{ id: string }>(
          'post',
          `/construction/admin/v1/projects/${cleanProjectId}/users`,
          twoLeggedToken,
          { data: accRequestData }
        );
      } catch (accError: any) {
        // ACC Admin API failed - try BIM 360 HQ API as fallback
        // This handles BIM 360 projects (which return "platform to be ACC" or 401 Unauthorized)
        const errorMsg = accError?.message || '';
        logger.info(`ACC Admin API failed for project ${cleanProjectId}, falling back to BIM 360 HQ API`, {
          accError: errorMsg,
        });

        // Look up user info from account members
        const userInfo = await this.getAccountUserInfo(accountId, email);

        // BIM 360 HQ API format requires: email (required), services (required), company_id (required)
        const hqRequestData: any = {
          email,
          services: {
            document_management: {
              access_level: 'admin',
            },
          },
        };

        // company_id is REQUIRED for BIM 360 HQ API
        if (userInfo.companyId) {
          hqRequestData.company_id = userInfo.companyId;
        } else {
          logger.warn(`No company_id available for ${email} - request may fail`);
        }

        // HQ API uses industry_roles (snake_case) instead of roleIds
        if (isValidRoleUuid) {
          hqRequestData.industry_roles = [role];
        }

        logger.info(`Sending BIM 360 HQ API request`, {
          email: hqRequestData.email,
          services: hqRequestData.services,
          companyId: hqRequestData.company_id,
          hasIndustryRoles: !!hqRequestData.industry_roles,
        });

        response = await this.makeRequest<{ id: string }>(
          'post',
          `/hq/v1/accounts/${accountId}/projects/${cleanProjectId}/users`,
          twoLeggedToken,
          { data: hqRequestData }
        );
      }

      logger.info(`Successfully added user ${email} to project ${cleanProjectId}`);

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
   * Uses 2-legged OAuth for ACC Admin API access
   */
  private async updateUserRole(
    projectId: string,
    userId: string,
    role: string
  ): Promise<AddUserToProjectResult> {
    try {
      // Get 2-legged token for Admin API
      const twoLeggedToken = await apsAuthService.getTwoLeggedToken();

      await this.makeRequest(
        'patch',
        `/construction/admin/v1/projects/${projectId}/users/${userId}`,
        twoLeggedToken,
        {
          data: {
            roleIds: [role],
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
          // Log full error details for debugging
          logger.error(`APS API Error on ${endpoint}`, {
            statusCode,
            responseData: error.response?.data,
            requestId: error.response?.headers['x-ads-request-id'],
          });

          // Extract error message - handle various API response formats
          let errorMessage = error.message;
          const responseData = error.response?.data;

          if (responseData) {
            // Check errors array FIRST (ACC Admin API returns errors in this format)
            if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
              errorMessage = responseData.errors.map((e: any) => e.detail || e.message || e.title || JSON.stringify(e)).join('; ');
            } else if (responseData.detail) {
              errorMessage = responseData.detail;
            } else if (responseData.message && responseData.message !== 'Check errors array') {
              errorMessage = responseData.message;
            } else if (responseData.title) {
              errorMessage = responseData.title;
            } else if (typeof responseData === 'string') {
              errorMessage = responseData;
            }
          }

          logger.error(`Extracted error message: ${errorMessage}`);

          throw new APSError(
            errorMessage,
            statusCode || 500,
            error.response?.data?.code || error.response?.data?.errorCode,
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
