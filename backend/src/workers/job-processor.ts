import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import { BulkAssignmentJobData, ProjectAssignmentTask } from '../types';
import apsProjectsService from '../services/aps/projects.service';
import { getDb } from '../db';
import logger from '../utils/logger';
import { chunkArray, wait, calculatePercentage } from '../utils/helpers';

/**
 * BullMQ Worker for processing bulk user assignment jobs
 * Runs as a separate process from the main API server
 */

const redisConnection = new Redis(config.redis.url, {
  password: config.redis.password,
  maxRetriesPerRequest: null,
});

const worker = new Worker<BulkAssignmentJobData>(
  'bulk-user-assignment',
  async (job: Job<BulkAssignmentJobData>) => {
    logger.info(`Processing job: ${job.id}`, {
      executionId: job.data.executionId,
    });

    const db = getDb();
    const { executionId, userId, accountId, userEmails, projectIds, role, accessToken } = job.data;

    try {
      // Update job execution status to processing
      await db.query(
        `UPDATE job_executions
         SET status = 'processing', started_at = NOW()
         WHERE id = $1`,
        [executionId]
      );

      // Create all job result records upfront
      const tasks: ProjectAssignmentTask[] = [];
      for (const projectId of projectIds) {
        for (const userEmail of userEmails) {
          // Get project name
          const project = await apsProjectsService.getProject(
            accessToken,
            accountId,
            projectId
          );

          // Create job result record
          const resultRow = await db.query(
            `INSERT INTO job_results
             (execution_id, project_id, project_name, user_email, assigned_role, status)
             VALUES ($1, $2, $3, $4, $5, 'pending')
             RETURNING id`,
            [executionId, projectId, project.name, userEmail, role]
          );

          tasks.push({
            executionId,
            projectId,
            projectName: project.name,
            userEmail,
            role,
            accountId,
            accessToken,
          });
        }
      }

      logger.info(`Created ${tasks.length} tasks for execution ${executionId}`);

      // Process tasks in batches to respect rate limits
      const batchSize = 5; // Process 5 at a time
      const batches = chunkArray(tasks, batchSize);

      let completedCount = 0;
      let successCount = 0;
      let failedCount = 0;

      for (const batch of batches) {
        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map((task) => processTask(task, db))
        );

        // Update counts
        results.forEach((result) => {
          completedCount++;
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
          } else {
            failedCount++;
          }
        });

        // Update job progress
        const progress = calculatePercentage(completedCount, tasks.length);
        await job.updateProgress(progress);

        // Update job execution
        await db.query(
          `UPDATE job_executions
           SET completed_count = $1, success_count = $2, failed_count = $3
           WHERE id = $4`,
          [completedCount, successCount, failedCount, executionId]
        );

        logger.info(`Progress: ${completedCount}/${tasks.length} (${progress}%)`, {
          executionId,
          successCount,
          failedCount,
        });

        // Small delay between batches to avoid rate limits
        if (batches.indexOf(batch) < batches.length - 1) {
          await wait(500);
        }
      }

      // Determine final status
      let finalStatus = 'completed';
      if (failedCount > 0 && successCount > 0) {
        finalStatus = 'partial_success';
      } else if (failedCount === tasks.length) {
        finalStatus = 'failed';
      }

      // Update job execution to completed
      await db.query(
        `UPDATE job_executions
         SET status = $1, completed_at = NOW()
         WHERE id = $2`,
        [finalStatus, executionId]
      );

      logger.info(`Job completed: ${job.id}`, {
        executionId,
        status: finalStatus,
        successCount,
        failedCount,
      });

      return {
        executionId,
        status: finalStatus,
        totalTasks: tasks.length,
        successCount,
        failedCount,
      };
    } catch (error) {
      logger.error(`Job failed: ${job.id}`, {
        executionId,
        error,
      });

      // Update job execution to failed
      await db.query(
        `UPDATE job_executions
         SET status = 'failed',
             error_message = $1,
             completed_at = NOW()
         WHERE id = $2`,
        [error instanceof Error ? error.message : 'Unknown error', executionId]
      );

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: config.queue.concurrency,
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per minute
    },
  }
);

/**
 * Process a single project assignment task
 */
async function processTask(
  task: ProjectAssignmentTask,
  db: any
): Promise<{ success: boolean }> {
  const { executionId, projectId, userEmail, role, accountId, accessToken } = task;

  // Find the job result record
  const resultRow = await db.query(
    `SELECT id FROM job_results
     WHERE execution_id = $1 AND project_id = $2 AND user_email = $3`,
    [executionId, projectId, userEmail]
  );

  const resultId = resultRow.rows[0].id;

  try {
    // Update status to processing
    await db.query(
      `UPDATE job_results
       SET status = 'processing', started_at = NOW()
       WHERE id = $1`,
      [resultId]
    );

    // Check if user already has access
    const existingUser = await apsProjectsService.checkUserInProject(
      accessToken,
      accountId,
      projectId,
      userEmail
    );

    if (existingUser) {
      const hasRole = existingUser.roleIds.includes(role);

      if (hasRole) {
        // User already has the role, skip
        await db.query(
          `UPDATE job_results
           SET status = 'skipped',
               previous_role = $1,
               action_taken = 'skipped',
               completed_at = NOW(),
               duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
           WHERE id = $2`,
          [role, resultId]
        );

        return { success: true };
      }
    }

    // Add user to project
    const result = await apsProjectsService.addUserToProject({
      accountId,
      projectId,
      email: userEmail,
      role,
      accessToken,
    });

    if (result.success) {
      await db.query(
        `UPDATE job_results
         SET status = 'success',
             previous_role = $1,
             action_taken = $2,
             api_request_id = $3,
             completed_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE id = $4`,
        [
          existingUser ? existingUser.roleIds[0] : null,
          existingUser ? 'updated' : 'added',
          result.apiRequestId,
          resultId,
        ]
      );

      return { success: true };
    } else {
      // Operation failed
      await db.query(
        `UPDATE job_results
         SET status = 'failed',
             error_code = $1,
             error_message = $2,
             api_request_id = $3,
             completed_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE id = $4`,
        [result.errorCode, result.errorMessage, result.apiRequestId, resultId]
      );

      return { success: false };
    }
  } catch (error) {
    logger.error('Task processing failed', {
      executionId,
      projectId,
      userEmail,
      error,
    });

    await db.query(
      `UPDATE job_results
       SET status = 'failed',
           error_message = $1,
           completed_at = NOW(),
           duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
       WHERE id = $2`,
      [error instanceof Error ? error.message : 'Unknown error', resultId]
    );

    return { success: false };
  }
}

// Worker event handlers
worker.on('completed', (job) => {
  logger.info(`Worker completed job: ${job.id}`);
});

worker.on('failed', (job, err) => {
  logger.error(`Worker failed job: ${job?.id}`, { error: err });
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker...');
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down worker...');
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});

logger.info('Worker started and listening for jobs');

export default worker;
