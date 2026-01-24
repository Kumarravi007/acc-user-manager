import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { config } from '../../config';
import {
  APSTokenResponse,
  APSUserProfile,
  APSAuthResult,
  AuthenticationError,
  APSError,
} from '../../types';
import logger from '../../utils/logger';

// State token expiration time (10 minutes)
const STATE_EXPIRATION_MS = 10 * 60 * 1000;

/**
 * APS OAuth 2.0 Authentication Service
 * Handles 3-legged OAuth flow for Autodesk Platform Services
 */
export class APSAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;
  private readonly baseUrl: string;

  // OAuth scopes required for ACC user management
  private readonly scopes = [
    'data:read',
    'data:write',
    'account:read',
    'account:write',
  ];

  constructor() {
    this.clientId = config.aps.clientId;
    this.clientSecret = config.aps.clientSecret;
    this.callbackUrl = config.aps.callbackUrl;
    this.baseUrl = config.aps.baseUrl;
  }

  /**
   * Generate authorization URL for OAuth flow
   * @param state - Random state parameter for CSRF protection
   * @returns Authorization URL to redirect user to
   */
  generateAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.callbackUrl,
      scope: this.scopes.join(' '),
      state,
    });

    return `${this.baseUrl}/authentication/v2/authorize?${params.toString()}`;
  }

  /**
   * Generate a self-verifiable signed state for CSRF protection.
   * This doesn't rely on session storage, making it work across domains.
   * Format: nonce.timestamp.signature
   */
  generateState(): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    const data = `${nonce}.${timestamp}`;

    // Create HMAC signature using session secret
    const signature = crypto
      .createHmac('sha256', config.session.secret)
      .update(data)
      .digest('hex');

    return `${data}.${signature}`;
  }

  /**
   * Verify a signed state token.
   * Checks signature validity and expiration.
   * @param state - The state token to verify
   * @returns true if valid, false otherwise
   */
  verifyState(state: string): boolean {
    try {
      const parts = state.split('.');
      if (parts.length !== 3) {
        logger.warn('Invalid state format: wrong number of parts');
        return false;
      }

      const [nonce, timestamp, signature] = parts;

      // Verify the signature
      const data = `${nonce}.${timestamp}`;
      const expectedSignature = crypto
        .createHmac('sha256', config.session.secret)
        .update(data)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      if (!crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )) {
        logger.warn('Invalid state: signature mismatch');
        return false;
      }

      // Check if state has expired
      const stateTime = parseInt(timestamp, 10);
      const now = Date.now();
      if (now - stateTime > STATE_EXPIRATION_MS) {
        logger.warn('Invalid state: expired', {
          stateTime,
          now,
          ageMs: now - stateTime
        });
        return false;
      }

      logger.info('State verification successful');
      return true;
    } catch (error) {
      logger.error('State verification error', { error });
      return false;
    }
  }

  /**
   * Exchange authorization code for access token
   * @param code - Authorization code from callback
   * @returns Token response with access and refresh tokens
   */
  async exchangeCodeForToken(code: string): Promise<APSTokenResponse> {
    try {
      const response = await axios.post<APSTokenResponse>(
        `${this.baseUrl}/authentication/v2/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.callbackUrl,
        }),
        {
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      logger.info('Successfully exchanged authorization code for token');
      return response.data;
    } catch (error) {
      this.handleAuthError(error, 'Failed to exchange code for token');
      throw error; // TypeScript needs this
    }
  }

  /**
   * Refresh an expired access token
   * @param refreshToken - Refresh token
   * @returns New token response
   */
  async refreshAccessToken(refreshToken: string): Promise<APSTokenResponse> {
    try {
      const response = await axios.post<APSTokenResponse>(
        `${this.baseUrl}/authentication/v2/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        {
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      logger.info('Successfully refreshed access token');
      return response.data;
    } catch (error) {
      this.handleAuthError(error, 'Failed to refresh access token');
      throw error;
    }
  }

  /**
   * Get user profile information
   * @param accessToken - Valid access token
   * @returns User profile data
   */
  async getUserProfile(accessToken: string): Promise<APSUserProfile> {
    try {
      const response = await axios.get<APSUserProfile>(
        `${this.baseUrl}/userprofile/v1/users/@me`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      logger.info(`Retrieved profile for user: ${response.data.emailId}`);
      return response.data;
    } catch (error) {
      this.handleAuthError(error, 'Failed to get user profile');
      throw error;
    }
  }

  /**
   * Complete authentication flow
   * Exchanges code, gets profile, and returns all auth data
   * @param code - Authorization code
   * @returns Complete authentication result
   */
  async completeAuthentication(code: string): Promise<APSAuthResult> {
    // Exchange code for tokens
    const tokenResponse = await this.exchangeCodeForToken(code);

    // Get user profile
    const userProfile = await this.getUserProfile(tokenResponse.access_token);

    // Calculate token expiration
    const expiresAt = new Date(
      Date.now() + tokenResponse.expires_in * 1000
    );

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
      userProfile,
    };
  }

  /**
   * Check if user is an account admin
   * @param accessToken - Valid access token
   * @param accountId - ACC Account ID
   * @param userId - APS User ID
   * @returns True if user is account admin
   */
  async isAccountAdmin(
    accessToken: string,
    accountId: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Get user's role in the account
      const response = await axios.get(
        `${this.baseUrl}/hq/v1/accounts/${accountId}/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const userRole = response.data.role;

      // Account admins have 'account_admin' role
      const isAdmin = userRole === 'account_admin';

      logger.info(
        `User ${userId} admin status in account ${accountId}: ${isAdmin}`
      );

      return isAdmin;
    } catch (error) {
      logger.error('Failed to check account admin status', { error });
      // If we can't determine, err on the side of caution
      return false;
    }
  }

  /**
   * Revoke access token (logout)
   * @param accessToken - Token to revoke
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/authentication/v2/revoke`,
        new URLSearchParams({
          token: accessToken,
          token_type_hint: 'access_token',
        }),
        {
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      logger.info('Successfully revoked access token');
    } catch (error) {
      // Log but don't throw - revocation failures shouldn't block logout
      logger.warn('Failed to revoke token', { error });
    }
  }

  /**
   * Handle authentication errors with proper error types
   */
  private handleAuthError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const statusCode = axiosError.response?.status || 500;
      const errorData = axiosError.response?.data;

      logger.error(context, {
        statusCode,
        errorData,
        message: axiosError.message,
      });

      if (statusCode === 401) {
        throw new AuthenticationError(
          errorData?.error_description || 'Authentication failed'
        );
      }

      throw new APSError(
        errorData?.error_description || context,
        statusCode,
        errorData?.error
      );
    }

    logger.error(context, { error });
    throw new Error(`${context}: ${error}`);
  }
}

export default new APSAuthService();
