import { Request, Response } from 'express';
import apsAuthService from '../services/aps/auth.service';
import { getDb } from '../db';
import { encrypt } from '../utils/helpers';
import logger from '../utils/logger';

/**
 * Authentication Controller
 * Handles OAuth login/logout flows
 */
export class AuthController {
  /**
   * Initiate OAuth login
   * GET /api/auth/login
   */
  async login(_req: Request, res: Response): Promise<void> {
    try {
      // Generate self-verifiable signed state for CSRF protection
      // This doesn't rely on session storage, so it works across domains
      const state = apsAuthService.generateState();

      // Generate authorization URL
      const authUrl = apsAuthService.generateAuthUrl(state);

      res.json({ authUrl });
    } catch (error) {
      logger.error('Login initiation failed', { error });
      res.status(500).json({ error: 'Failed to initiate login' });
    }
  }

  /**
   * Handle OAuth callback
   * GET /api/auth/callback
   */
  async callback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      // Validate state using cryptographic verification (stateless approach)
      // This doesn't rely on session storage, so it works across domains
      if (!state || !apsAuthService.verifyState(state as string)) {
        logger.warn('OAuth callback failed: invalid state', { state });
        res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
        return;
      }

      // Exchange code for token
      const authResult = await apsAuthService.completeAuthentication(
        code as string
      );

      const db = getDb();

      // Check if user exists
      let userRow = await db.query(
        'SELECT * FROM users WHERE aps_user_id = $1',
        [authResult.userProfile.userId]
      );

      let userId: string;

      if (userRow.rows.length === 0) {
        // Create new user
        const insertResult = await db.query(
          `INSERT INTO users
           (aps_user_id, email, name, access_token_encrypted,
            refresh_token_encrypted, token_expires_at, last_login_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING id`,
          [
            authResult.userProfile.userId,
            authResult.userProfile.emailId,
            `${authResult.userProfile.firstName} ${authResult.userProfile.lastName}`,
            encrypt(authResult.accessToken),
            encrypt(authResult.refreshToken),
            authResult.expiresAt,
          ]
        );

        userId = insertResult.rows[0].id;

        logger.info('New user created', {
          userId,
          email: authResult.userProfile.emailId,
        });
      } else {
        // Update existing user
        userId = userRow.rows[0].id;

        await db.query(
          `UPDATE users
           SET access_token_encrypted = $1,
               refresh_token_encrypted = $2,
               token_expires_at = $3,
               last_login_at = NOW()
           WHERE id = $4`,
          [
            encrypt(authResult.accessToken),
            encrypt(authResult.refreshToken),
            authResult.expiresAt,
            userId,
          ]
        );

        logger.info('User logged in', {
          userId,
          email: authResult.userProfile.emailId,
        });
      }

      // Store user session
      req.session.userId = userId;
      req.session.apsUserId = authResult.userProfile.userId;
      req.session.email = authResult.userProfile.emailId;

      // Audit log
      await db.query(
        `INSERT INTO audit_logs (user_id, action, success)
         VALUES ($1, 'user_login', true)`,
        [userId]
      );

      // Redirect to frontend
      res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    } catch (error) {
      logger.error('OAuth callback failed', { error });
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  }

  /**
   * Get current user session
   * GET /api/auth/me
   */
  async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.session.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const db = getDb();
      const userRow = await db.query(
        `SELECT id, aps_user_id, email, name, account_id, is_account_admin
         FROM users
         WHERE id = $1`,
        [req.session.userId]
      );

      if (userRow.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user: userRow.rows[0] });
    } catch (error) {
      logger.error('Failed to get user session', { error });
      res.status(500).json({ error: 'Failed to get user session' });
    }
  }

  /**
   * Logout
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.session.userId;

      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          logger.error('Failed to destroy session', { error: err });
        }
      });

      // Audit log
      if (userId) {
        const db = getDb();
        await db.query(
          `INSERT INTO audit_logs (user_id, action, success)
           VALUES ($1, 'user_logout', true)`,
          [userId]
        );
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Logout failed', { error });
      res.status(500).json({ error: 'Logout failed' });
    }
  }
}

export default new AuthController();
