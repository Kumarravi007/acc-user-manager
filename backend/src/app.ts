import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import connectPgSimple from 'connect-pg-simple';
import { Redis } from 'ioredis';
import { config } from './config';
import { initializeDatabase, getDb } from './db';
import logger from './utils/logger';

// Controllers
import authController from './controllers/auth.controller';
import projectsController from './controllers/projects.controller';
import bulkOperationsController from './controllers/bulk-operations.controller';

const app: Application = express();

// Trust proxy - required for secure cookies behind Railway's proxy
app.set('trust proxy', 1);

// Initialize database
initializeDatabase();

// Redis client for rate limiting
const redisClient = new Redis(config.redis.url, {
  password: config.redis.password,
});

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: config.security.corsOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool: getDb(),
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      maxAge: config.session.maxAge,
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================================================
// Authentication Middleware
// ============================================================================

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

// ============================================================================
// Routes
// ============================================================================

// Health check with dependency verification
app.get('/health', async (_req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    // Check database connection
    const db = getDb();
    await db.query('SELECT 1');
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
    logger.error('Database health check failed', { error });
  }

  try {
    // Check Redis connection
    await redisClient.ping();
    health.services.redis = 'healthy';
  } catch (error) {
    health.services.redis = 'unhealthy';
    health.status = 'degraded';
    logger.error('Redis health check failed', { error });
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Auth routes
app.get('/api/auth/login', authController.login.bind(authController));
app.get('/api/auth/callback', authController.callback.bind(authController));
app.get(
  '/api/auth/me',
  requireAuth,
  authController.me.bind(authController)
);
app.post(
  '/api/auth/logout',
  requireAuth,
  authController.logout.bind(authController)
);

// Projects routes
app.get(
  '/api/projects',
  requireAuth,
  projectsController.getProjects.bind(projectsController)
);
app.get(
  '/api/projects/:projectId',
  requireAuth,
  projectsController.getProject.bind(projectsController)
);
app.get(
  '/api/projects/:projectId/users',
  requireAuth,
  projectsController.getProjectUsers.bind(projectsController)
);
app.get(
  '/api/projects/:projectId/roles',
  requireAuth,
  projectsController.getProjectRoles.bind(projectsController)
);

// Bulk operations routes
app.post(
  '/api/bulk/preview',
  requireAuth,
  bulkOperationsController.preview.bind(bulkOperationsController)
);
app.post(
  '/api/bulk/assign',
  requireAuth,
  bulkOperationsController.assign.bind(bulkOperationsController)
);
app.get(
  '/api/bulk/status/:executionId',
  requireAuth,
  bulkOperationsController.getStatus.bind(bulkOperationsController)
);
app.get(
  '/api/bulk/history',
  requireAuth,
  bulkOperationsController.getHistory.bind(bulkOperationsController)
);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: config.nodeEnv === 'development' ? err.message : 'Internal server error',
  });
});

// Start server
const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;
