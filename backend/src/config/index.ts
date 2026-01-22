import dotenv from 'dotenv';
import { AppConfig } from '../types';

// Load environment variables
dotenv.config();

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

function getEnvVarAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

export const config: AppConfig = {
  port: getEnvVarAsNumber('PORT', 3001),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  logLevel: getEnvVar('LOG_LEVEL', 'info'),

  aps: {
    clientId: getEnvVar('APS_CLIENT_ID'),
    clientSecret: getEnvVar('APS_CLIENT_SECRET'),
    callbackUrl: getEnvVar('APS_CALLBACK_URL'),
    baseUrl: getEnvVar('APS_BASE_URL', 'https://developer.api.autodesk.com'),
  },

  database: {
    url: getEnvVar('DATABASE_URL'),
    poolMin: getEnvVarAsNumber('DATABASE_POOL_MIN', 2),
    poolMax: getEnvVarAsNumber('DATABASE_POOL_MAX', 10),
  },

  redis: {
    url: getEnvVar('REDIS_URL', 'redis://localhost:6379'),
    password: process.env.REDIS_PASSWORD,
  },

  session: {
    secret: getEnvVar('SESSION_SECRET'),
    maxAge: getEnvVarAsNumber('SESSION_MAX_AGE', 86400000), // 24 hours
  },

  security: {
    encryptionKey: getEnvVar('ENCRYPTION_KEY'),
    corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
  },

  rateLimit: {
    windowMs: getEnvVarAsNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
    maxRequests: getEnvVarAsNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  queue: {
    concurrency: getEnvVarAsNumber('QUEUE_CONCURRENCY', 3),
    jobTimeoutMs: getEnvVarAsNumber('JOB_TIMEOUT_MS', 300000), // 5 minutes
    maxRetries: getEnvVarAsNumber('JOB_MAX_RETRIES', 3),
  },
};

export default config;
