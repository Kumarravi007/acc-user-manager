import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import apsProjectsService from '../services/aps/projects.service';
import queueService from '../services/queue/queue.service';
import { getDb } from '../db';
import { decrypt, validateEmails } from '../utils/helpers';
import logger from '../utils/logger';
import {
  BulkUserAssignmentRequest,
  PreviewRequest,
  PreviewResult,
} from '../types';

/**
 * Bulk Operations Controller
 * Handles bulk user assignment operations
 */
export class BulkOperationsController {
  /**
   * Preview bulk user assignment
   * POST /api/bulk/preview
   */
  async preview(req: Request, res: Response): Promise<void> {
    try {
      const { userEmails, projectIds }: PreviewRequest = req.body;
      const userId = req.session.userId!;
      const db = getDb();

      // Validate emails
      const { valid, invalid } = validateEmails(userEmails);

      if (invalid.length > 0) {
        res.status(400).json({
          error: 'Invalid email addresses',
          invalidEmails: invalid,
        });
        return;
      }

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

      // Check access for each user in each project
      const previewResults: PreviewResult[] = [];

      for (const projectId of projectIds) {
        // Get project details
        const project = await apsProjectsService.getProject(
          accessToken,
          accountId,
          projectId
        );

        // Get current users in project
        const projectUsers = await apsProjectsService.getProjectUsers(
          accessToken,
          accountId,
          projectId
        );

        for (const email of valid) {
          const existingUser = projectUsers.find(
            (u) => u.email.toLowerCase() === email.toLowerCase()
          );

          previewResults.push({
            userEmail: email,
            projectId,
            projectName: project.name,
            currentAccess: {
              hasAccess: !!existingUser,
              currentRole: existingUser?.roleIds[0],
            },
            willBeAdded: !existingUser,
            willBeUpdated: !!existingUser,
          });
        }
      }

      // Audit log
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, success, details)
         VALUES ($1, 'user_preview', 'project', true, $2)`,
        [
          userId,
          JSON.stringify({
            userCount: valid.length,
            projectCount: projectIds.length,
          }),
        ]
      );

      res.json({
        preview: previewResults,
        summary: {
          totalOperations: previewResults.length,
          newUsers: previewResults.filter((r) => r.willBeAdded).length,
          updates: previewResults.filter((r) => r.willBeUpdated).length,
        },
      });
    } catch (error) {
      logger.error('Preview failed', { error });
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  }

  /**
   * Execute bulk user assignment
   * POST /api/bulk/assign
   */
  async assign(req: Request, res: Response): Promise<void> {
    try {
      const { userEmails, projectIds, role }: BulkUserAssignmentRequest =
        req.body;
      const userId = req.session.userId!;
      const db = getDb();

      // Validate inputs
      if (!userEmails || userEmails.length === 0) {
        res.status(400).json({ error: 'No user emails provided' });
        return;
      }

      if (!projectIds || projectIds.length === 0) {
        res.status(400).json({ error: 'No projects selected' });
        return;
      }

      if (!role) {
        res.status(400).json({ error: 'No role specified' });
        return;
      }

      // Validate emails
      const { valid, invalid } = validateEmails(userEmails);

      if (invalid.length > 0) {
        res.status(400).json({
          error: 'Invalid email addresses',
          invalidEmails: invalid,
        });
        return;
      }

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

      // Create job execution record
      const executionId = uuidv4();
      const totalProjects = projectIds.length * valid.length;

      await db.query(
        `INSERT INTO job_executions
         (id, user_id, job_type, status, target_user_emails,
          target_project_ids, assigned_role, total_projects)
         VALUES ($1, $2, 'bulk_user_assignment', 'pending', $3, $4, $5, $6)`,
        [executionId, userId, valid, projectIds, role, totalProjects]
      );

      // Add job to queue
      await queueService.addBulkAssignmentJob({
        executionId,
        userId,
        accountId,
        userEmails: valid,
        projectIds,
        role,
        accessToken,
      });

      // Audit log
      await db.query(
        `INSERT INTO audit_logs
         (user_id, execution_id, action, resource_type, success, details)
         VALUES ($1, $2, 'job_created', 'job', true, $3)`,
        [
          userId,
          executionId,
          JSON.stringify({
            userCount: valid.length,
            projectCount: projectIds.length,
            totalOperations: totalProjects,
          }),
        ]
      );

      logger.info('Bulk assignment job created', {
        executionId,
        userId,
        userCount: valid.length,
        projectCount: projectIds.length,
      });

      res.json({
        executionId,
        status: 'pending',
        totalProjects,
        message: 'Job queued successfully',
      });
    } catch (error) {
      logger.error('Failed to create bulk assignment job', { error });
      res.status(500).json({ error: 'Failed to create assignment job' });
    }
  }

  /**
   * Get job execution status
   * GET /api/bulk/status/:executionId
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      const userId = req.session.userId!;
      const db = getDb();

      // Get job execution
      const executionRow = await db.query(
        `SELECT * FROM job_executions WHERE id = $1 AND user_id = $2`,
        [executionId, userId]
      );

      if (executionRow.rows.length === 0) {
        res.status(404).json({ error: 'Job execution not found' });
        return;
      }

      const execution = executionRow.rows[0];

      // Get job results
      const resultsRow = await db.query(
        `SELECT * FROM job_results WHERE execution_id = $1 ORDER BY created_at`,
        [executionId]
      );

      const results = resultsRow.rows;

      // Calculate progress
      const percentage =
        execution.total_projects > 0
          ? Math.round(
              (execution.completed_count / execution.total_projects) * 100
            )
          : 0;

      res.json({
        id: executionId,
        status: execution.status,
        progress: {
          total: execution.total_projects,
          completed: execution.completed_count,
          success: execution.success_count,
          failed: execution.failed_count,
          percentage,
        },
        results: results.map((r: any) => ({
          id: r.id,
          projectId: r.project_id,
          projectName: r.project_name,
          userEmail: r.user_email,
          status: r.status,
          previousRole: r.previous_role,
          assignedRole: r.assigned_role,
          actionTaken: r.action_taken,
          errorMessage: r.error_message,
          completedAt: r.completed_at,
        })),
        startedAt: execution.started_at,
        completedAt: execution.completed_at,
        estimatedTimeRemaining: null, // TODO: Calculate based on progress
      });
    } catch (error) {
      logger.error('Failed to get job status', { error });
      res.status(500).json({ error: 'Failed to retrieve job status' });
    }
  }

  /**
   * Get user's job history
   * GET /api/bulk/history
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.userId!;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const db = getDb();

      const historyRow = await db.query(
        `SELECT id, status, total_projects, success_count, failed_count,
                started_at, completed_at, created_at
         FROM job_executions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      res.json({
        executions: historyRow.rows,
        pagination: {
          limit,
          offset,
          hasMore: historyRow.rows.length === limit,
        },
      });
    } catch (error) {
      logger.error('Failed to get job history', { error });
      res.status(500).json({ error: 'Failed to retrieve job history' });
    }
  }
}

export default new BulkOperationsController();
