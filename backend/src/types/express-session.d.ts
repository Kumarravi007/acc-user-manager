import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: number;
    oauthState?: string;
  }
}
