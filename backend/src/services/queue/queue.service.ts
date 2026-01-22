import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../../config';
import { BulkAssignmentJobData } from '../../types';
import logger from '../../utils/logger';

/**
 * Job Queue Service using BullMQ
 * Manages async bulk user assignment operations
 */
export class QueueService {
  private queue: Queue<BulkAssignmentJobData>;
  private queueEvents: QueueEvents;
  private redisConnection: Redis;

  constructor() {
    // Create Redis connection
    this.redisConnection = new Redis(config.redis.url, {
      password: config.redis.password,
      maxRetriesPerRequest: null,
    });

    // Create queue
    this.queue = new Queue<BulkAssignmentJobData>('bulk-user-assignment', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: config.queue.maxRetries,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    });

    // Create queue events listener
    this.queueEvents = new QueueEvents('bulk-user-assignment', {
      connection: this.redisConnection,
    });

    this.setupEventListeners();

    logger.info('Queue service initialized');
  }

  /**
   * Add a bulk assignment job to the queue
   * @param data - Job data
   * @returns Job ID
   */
  async addBulkAssignmentJob(
    data: BulkAssignmentJobData
  ): Promise<string> {
    try {
      const job = await this.queue.add(
        'bulk-assignment',
        data,
        {
          jobId: data.executionId,
        }
      );

      logger.info(`Job added to queue: ${job.id}`, {
        executionId: data.executionId,
        projectCount: data.projectIds.length,
        userCount: data.userEmails.length,
      });

      return job.id!;
    } catch (error) {
      logger.error('Failed to add job to queue', {
        executionId: data.executionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get job status
   * @param jobId - Job ID
   * @returns Job state
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress;

      return {
        id: job.id,
        state,
        progress,
        data: job.data,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      };
    } catch (error) {
      logger.error('Failed to get job status', { jobId, error });
      throw error;
    }
  }

  /**
   * Cancel a job
   * @param jobId - Job ID
   */
  async cancelJob(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);

      if (job) {
        await job.remove();
        logger.info(`Job cancelled: ${jobId}`);
      }
    } catch (error) {
      logger.error('Failed to cancel job', { jobId, error });
      throw error;
    }
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      logger.error('Failed to get queue metrics', { error });
      throw error;
    }
  }

  /**
   * Clean old jobs from queue
   */
  async cleanOldJobs(): Promise<void> {
    try {
      // Clean completed jobs older than 24 hours
      await this.queue.clean(86400000, 1000, 'completed');

      // Clean failed jobs older than 7 days
      await this.queue.clean(604800000, 1000, 'failed');

      logger.info('Old jobs cleaned from queue');
    } catch (error) {
      logger.error('Failed to clean old jobs', { error });
    }
  }

  /**
   * Setup event listeners for monitoring
   */
  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`Job completed: ${jobId}`, { returnvalue });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job failed: ${jobId}`, { failedReason });
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug(`Job progress: ${jobId}`, { progress: data });
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.warn(`Job stalled: ${jobId}`);
    });
  }

  /**
   * Gracefully close queue connections
   */
  async close(): Promise<void> {
    await this.queue.close();
    await this.queueEvents.close();
    await this.redisConnection.quit();
    logger.info('Queue service closed');
  }
}

export default new QueueService();
