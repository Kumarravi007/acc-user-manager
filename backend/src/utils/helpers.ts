import CryptoJS from 'crypto-js';
import { config } from '../config';

/**
 * Utility helper functions
 */

/**
 * Wait for specified milliseconds
 * @param ms - Milliseconds to wait
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Encrypt sensitive data (e.g., OAuth tokens)
 * @param data - Data to encrypt
 * @returns Encrypted string
 */
export function encrypt(data: string): string {
  return CryptoJS.AES.encrypt(data, config.security.encryptionKey).toString();
}

/**
 * Decrypt encrypted data
 * @param encryptedData - Encrypted string
 * @returns Decrypted string
 */
export function decrypt(encryptedData: string): string {
  const bytes = CryptoJS.AES.decrypt(
    encryptedData,
    config.security.encryptionKey
  );
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns True if valid email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate array of emails
 * @param emails - Array of emails
 * @returns Object with valid emails and invalid emails
 */
export function validateEmails(emails: string[]): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];

  emails.forEach((email) => {
    if (isValidEmail(email.trim())) {
      valid.push(email.trim().toLowerCase());
    } else {
      invalid.push(email.trim());
    }
  });

  return { valid, invalid };
}

/**
 * Chunk array into smaller arrays
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Calculate percentage
 * @param completed - Completed count
 * @param total - Total count
 * @returns Percentage (0-100)
 */
export function calculatePercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Estimate remaining time based on current progress
 * @param startTime - Start time
 * @param completed - Completed count
 * @param total - Total count
 * @returns Estimated seconds remaining
 */
export function estimateTimeRemaining(
  startTime: Date,
  completed: number,
  total: number
): number | null {
  if (completed === 0 || completed === total) return null;

  const elapsedMs = Date.now() - startTime.getTime();
  const avgTimePerItem = elapsedMs / completed;
  const remaining = total - completed;

  return Math.round((avgTimePerItem * remaining) / 1000);
}

/**
 * Sanitize string for logging (remove sensitive data)
 * @param str - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeForLog(str: string): string {
  // Remove potential tokens, passwords, etc.
  return str.replace(
    /Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi,
    'Bearer [REDACTED]'
  );
}

/**
 * Format error for consistent error responses
 * @param error - Error object
 * @returns Formatted error object
 */
export function formatError(error: any): {
  message: string;
  code?: string;
  statusCode?: number;
} {
  if (error.response) {
    return {
      message: error.response.data?.message || error.message,
      code: error.response.data?.code,
      statusCode: error.response.status,
    };
  }

  return {
    message: error.message || 'An unexpected error occurred',
    code: error.code,
    statusCode: error.statusCode || 500,
  };
}

/**
 * Retry function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param delayMs - Initial delay in milliseconds
 * @returns Result of function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const backoffDelay = delayMs * Math.pow(2, attempt - 1);
        await wait(backoffDelay);
      }
    }
  }

  throw lastError!;
}
