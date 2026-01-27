import { Request, Response } from 'express';
import apsProjectsService from '../services/aps/projects.service';
import { getDb } from '../db';
import { decrypt, getValidAccessToken } from '../utils/helpers';
import { APSError } from '../types';
import logger from '../utils/logger';

/**
 * Projects Controller
 * Handles project listing and management
 */
export class ProjectsController {
  /**
   * Get all ACC accounts the user has access to
   * GET /api/accounts
   */
  async getAccounts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.userId!;
      const db = getDb();

      // Get valid access token (refreshes if expired)
      let accessToken: string;
      try {
        const tokenResult = await getValidAccessToken(db, userId);
        accessToken = tokenResult.accessToken;
      } catch (tokenError) {
        logger.error('Token error in getAccounts', {
          userId,
          error: tokenError instanceof Error ? tokenError.message : String(tokenError),
        });
        res.status(401).json({ error: 'Session expired. Please log in again.' });
        return;
      }

      // Fetch accounts from APS
      const accounts = await apsProjectsService.getUserAccounts(accessToken);

      res.json({
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          region: a.region,
        })),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get accounts', { errorMessage });
      res.status(500).json({ error: 'Failed to retrieve accounts' });
    }
  }

  /**
   * Get all projects for a specific account
   * GET /api/projects?accountId=xxx
   */
  async getProjects(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.userId!;
      const db = getDb();
      const queryAccountId = req.query.accountId as string | undefined;

      // Get valid access token (refreshes if expired)
      let accessToken: string;
      let storedAccountId: string | null;
      try {
        const tokenResult = await getValidAccessToken(db, userId);
        accessToken = tokenResult.accessToken;
        storedAccountId = tokenResult.accountId;
      } catch (tokenError) {
        logger.error('Token error in getProjects', {
          userId,
          error: tokenError instanceof Error ? tokenError.message : String(tokenError),
        });
        res.status(401).json({ error: 'Session expired. Please log in again.' });
        return;
      }

      // Use query param accountId if provided, otherwise fall back to stored
      const finalAccountId = queryAccountId || storedAccountId;
      if (!finalAccountId) {
        res.status(400).json({
          error: 'Account ID required. Please select an account.',
        });
        return;
      }

      // Fetch projects from APS
      const projects = await apsProjectsService.getProjects(
        accessToken,
        finalAccountId
      );

      // Cache projects in database
      for (const project of projects) {
        await db.query(
          `INSERT INTO projects
           (account_id, project_id, project_name, project_type, status, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (project_id)
           DO UPDATE SET
             project_name = EXCLUDED.project_name,
             project_type = EXCLUDED.project_type,
             status = EXCLUDED.status,
             last_synced_at = NOW()`,
          [
            finalAccountId,
            project.id,
            project.name,
            project.platform,
            project.status,
          ]
        );
      }

      // Audit log
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, success, details)
         VALUES ($1, 'projects_fetched', 'project', true, $2)`,
        [userId, JSON.stringify({ count: projects.length })]
      );

      res.json({
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          platform: p.platform,
        })),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get projects', {
        errorMessage,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });
      res.status(500).json({ error: 'Failed to retrieve projects' });
    }
  }

  /**
   * Get project details
   * GET /api/projects/:projectId
   */
  async getProject(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.session.userId!;
      const db = getDb();

      // Get user's access token
      const userRow = await db.query(
        'SELECT access_token_encrypted, account_id FROM users WHERE id = $1',
        [userId]
      );

      if (userRow.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const accessToken = decrypt(userRow.rows[0].access_token_encrypted);
      const accountId = userRow.rows[0].account_id;

      // Fetch project from APS
      const project = await apsProjectsService.getProject(
        accessToken,
        accountId,
        projectId
      );

      res.json({ project });
    } catch (error) {
      logger.error('Failed to get project', { error });
      res.status(500).json({ error: 'Failed to retrieve project' });
    }
  }

  /**
   * Get users in a project
   * GET /api/projects/:projectId/users
   */
  async getProjectUsers(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.session.userId!;
      const db = getDb();

      // Get user's access token
      const userRow = await db.query(
        'SELECT access_token_encrypted, account_id FROM users WHERE id = $1',
        [userId]
      );

      if (userRow.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const accessToken = decrypt(userRow.rows[0].access_token_encrypted);
      const accountId = userRow.rows[0].account_id;

      // Fetch project users from APS
      const users = await apsProjectsService.getProjectUsers(
        accessToken,
        accountId,
        projectId
      );

      res.json({ users });
    } catch (error) {
      logger.error('Failed to get project users', { error });
      res.status(500).json({ error: 'Failed to retrieve project users' });
    }
  }

  /**
   * Get available roles in a project
   * GET /api/projects/:projectId/roles
   */
  async getProjectRoles(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = req.session.userId!;
      const db = getDb();

      // Get user's access token
      const userRow = await db.query(
        'SELECT access_token_encrypted, account_id FROM users WHERE id = $1',
        [userId]
      );

      if (userRow.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const accessToken = decrypt(userRow.rows[0].access_token_encrypted);
      const accountId = userRow.rows[0].account_id;

      // Fetch project roles from APS
      const roles = await apsProjectsService.getProjectRoles(
        accessToken,
        accountId,
        projectId
      );

      res.json({ roles });
    } catch (error) {
      logger.error('Failed to get project roles', { error });
      res.status(500).json({ error: 'Failed to retrieve project roles' });
    }
  }

  /**
   * Get available roles (from ACC Admin > Roles)
   * Uses project-level endpoint since account-level doesn't exist for ACC
   * GET /api/account/roles?accountId=xxx
   */
  async getAccountRoles(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.userId!;
      const db = getDb();
      const queryAccountId = req.query.accountId as string | undefined;

      // Get valid access token (refreshes if expired)
      let accessToken: string;
      let storedAccountId: string | null;
      try {
        const tokenResult = await getValidAccessToken(db, userId);
        accessToken = tokenResult.accessToken;
        storedAccountId = tokenResult.accountId;
      } catch (tokenError) {
        logger.error('Token error in getAccountRoles', {
          userId,
          error: tokenError instanceof Error ? tokenError.message : String(tokenError),
        });
        res.status(401).json({ error: 'Session expired. Please log in again.' });
        return;
      }

      // Use query param accountId if provided, otherwise fall back to stored
      const accountId = queryAccountId || storedAccountId;
      if (!accountId) {
        res.status(400).json({
          error: 'Account ID required. Please select an account.',
        });
        return;
      }

      // Try to get account-level roles directly
      try {
        logger.info(`Getting account-level roles for account ${accountId}`);
        const roles = await apsProjectsService.getAccountRoles(accessToken, accountId);

        res.json({
          roles: roles.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
          })),
        });
        return;
      } catch (accountRolesError) {
        logger.warn('Account-level roles failed, returning empty', {
          error: accountRolesError instanceof Error ? accountRolesError.message : String(accountRolesError),
        });
        // If account-level fails, return empty array (UI will use defaults)
        res.json({ roles: [] });
        return;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get account roles', {
        errorMessage,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });

      if (error instanceof APSError) {
        if (error.statusCode === 403) {
          res.status(403).json({
            error: 'Permission denied. Please ensure: 1) Your APS app is added to ACC Admin > Custom Integrations, and 2) You are an Account Admin.',
            hint: 'Go to ACC Admin Portal > Settings > Custom Integrations > Add Custom Integration, and add your app using its Client ID.',
          });
          return;
        }
      }

      res.status(500).json({ error: 'Failed to retrieve roles' });
    }
  }

  /**
   * Get all members in the account (from ACC Admin)
   * GET /api/account/members?accountId=xxx
   */
  async getAccountMembers(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.userId!;
      const db = getDb();
      const queryAccountId = req.query.accountId as string | undefined;

      // Get valid access token (refreshes if expired)
      let accessToken: string;
      let storedAccountId: string | null;
      try {
        const tokenResult = await getValidAccessToken(db, userId);
        accessToken = tokenResult.accessToken;
        storedAccountId = tokenResult.accountId;
      } catch (tokenError) {
        logger.error('Token error in getAccountMembers', {
          userId,
          error: tokenError instanceof Error ? tokenError.message : String(tokenError),
        });
        res.status(401).json({ error: 'Session expired. Please log in again.' });
        return;
      }

      // Use query param accountId if provided, otherwise fall back to stored
      const accountId = queryAccountId || storedAccountId;
      if (!accountId) {
        res.status(400).json({
          error: 'Account ID required. Please select an account.',
        });
        return;
      }

      // Fetch account members from APS
      const members = await apsProjectsService.getAccountUsers(
        accessToken,
        accountId
      );

      // Filter to only active members
      const activeMembers = members.filter(m => m.status === 'active');

      res.json({
        members: activeMembers.map((m) => ({
          id: m.id,
          email: m.email,
          name: m.name,
          firstName: m.firstName,
          lastName: m.lastName,
          companyName: m.companyName,
        })),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get account members', {
        errorMessage,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });

      // Return more specific error messages based on error type
      if (error instanceof APSError) {
        if (error.statusCode === 403) {
          res.status(403).json({
            error: 'Permission denied. Please ensure: 1) Your APS app is added to ACC Admin > Custom Integrations, and 2) You are an Account Admin.',
            hint: 'Go to ACC Admin Portal > Settings > Custom Integrations > Add Custom Integration, and add your app using its Client ID.',
          });
          return;
        }
        if (error.statusCode === 404) {
          res.status(404).json({
            error: 'Account members could not be found. The ACC Admin API may not be available for this account.',
          });
          return;
        }
      }

      res.status(500).json({ error: 'Failed to retrieve account members' });
    }
  }
}

export default new ProjectsController();
