# Architecture Documentation

## System Overview

ACC Multi-Project User Manager is a production-ready web application that enables Autodesk Construction Cloud (ACC) Account Administrators to efficiently add users to multiple projects simultaneously through a clean, admin-focused interface.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Next.js 14 Frontend (React + TypeScript)                  │ │
│  │  - Server-side rendering                                   │ │
│  │  - Client-side state management (React Query)              │ │
│  │  - Responsive UI (TailwindCSS + shadcn/ui)                 │ │
│  └─────────────────────┬──────────────────────────────────────┘ │
└────────────────────────┼────────────────────────────────────────┘
                         │ HTTPS/REST
┌────────────────────────▼────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Express.js API Server (Node.js + TypeScript)             │ │
│  │  - Session management (connect-pg-simple)                 │ │
│  │  - Rate limiting (express-rate-limit + Redis)             │ │
│  │  - Authentication middleware                              │ │
│  │  - Request validation                                     │ │
│  └─────────────────────┬──────────────────────────────────────┘ │
└────────────────────────┼────────────────────────────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
┌───▼────────┐  ┌────────▼───────┐  ┌────────▼──────────┐
│ Controller │  │   Service      │  │    Repository     │
│   Layer    │──│    Layer       │──│      Layer        │
│            │  │                │  │                   │
│ - Auth     │  │ - APS OAuth    │  │ - User Repo       │
│ - Projects │  │ - APS Projects │  │ - Project Repo    │
│ - Bulk Ops │  │ - Queue Mgmt   │  │ - Job Repo        │
└────────────┘  └────────────────┘  └───────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼───┐   ┌──────▼──────┐  ┌────▼──────────────┐
    │ Redis  │   │ PostgreSQL  │  │  APS/ACC APIs     │
    │        │   │             │  │                   │
    │ - Jobs │   │ - Users     │  │ - OAuth           │
    │ - Cache│   │ - Projects  │  │ - Projects API    │
    │ - Rate │   │ - Jobs      │  │ - Users API       │
    │  Limit │   │ - Audit     │  │ - Roles API       │
    └────┬───┘   └─────────────┘  └───────────────────┘
         │
    ┌────▼─────────────────┐
    │  BullMQ Job Worker   │
    │  (Separate Process)  │
    │                      │
    │ - Bulk operations    │
    │ - Retry logic        │
    │ - Progress tracking  │
    └──────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Language**: TypeScript 5.3
- **Styling**: TailwindCSS 3.4 + shadcn/ui components
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4
- **Language**: TypeScript 5.3
- **Session**: express-session + connect-pg-simple
- **Rate Limiting**: express-rate-limit + rate-limit-redis
- **Security**: helmet, cors
- **Logging**: Winston

### Database & Cache
- **Primary Database**: PostgreSQL 15+
- **Cache & Queue**: Redis 7+
- **Job Queue**: BullMQ 5
- **Connection Pool**: pg (node-postgres)

### External Services
- **Authentication**: Autodesk Platform Services (APS) OAuth 2.0
- **Project Data**: APS BIM 360 / ACC APIs

## Core Components

### 1. Authentication Service (`auth.service.ts`)

**Purpose**: Handle OAuth 2.0 authentication with Autodesk Platform Services.

**Key Features**:
- 3-legged OAuth flow
- Token exchange and refresh
- User profile retrieval
- Admin role verification
- Token encryption

**Flow**:
```
User → Login → APS OAuth → Callback → Token Exchange →
→ Store Encrypted Tokens → Create Session → Redirect to Dashboard
```

### 2. APS Projects Service (`projects.service.ts`)

**Purpose**: Interact with APS/ACC APIs for project and user management.

**Key Features**:
- Fetch all projects for an account
- Get project users and roles
- Add/update users in projects
- Check existing user access
- Rate limit handling with automatic retry
- Exponential backoff for transient errors

**Rate Limiting Strategy**:
- Respects APS rate limits (429 responses)
- Automatic retry with exponential backoff
- Configurable retry count (default: 3)

### 3. Queue Service (`queue.service.ts`)

**Purpose**: Manage asynchronous bulk operations using BullMQ.

**Key Features**:
- Job creation and queuing
- Job status tracking
- Progress updates
- Automatic retry on failure
- Job metrics and monitoring

**Job Lifecycle**:
```
Created (pending) → Queued → Processing → Completed/Failed
```

### 4. Job Processor Worker (`job-processor.ts`)

**Purpose**: Process bulk user assignment jobs asynchronously.

**Key Features**:
- Runs as separate process from API server
- Batch processing to respect rate limits
- Per-project result tracking
- Real-time progress updates
- Comprehensive error handling

**Processing Strategy**:
1. Create all job result records upfront
2. Process in batches (default: 5 concurrent)
3. Update progress after each batch
4. Small delay between batches to avoid rate limits
5. Final status determination based on results

### 5. Database Layer

**Tables**:

1. **users**
   - Authenticated ACC users
   - Encrypted OAuth tokens
   - Admin status

2. **projects**
   - Cached project data
   - Reduces API calls
   - Synced periodically

3. **job_executions**
   - Bulk operation tracking
   - Overall job status
   - Progress metrics

4. **job_results**
   - Per-project operation results
   - Detailed error information
   - API request tracking

5. **audit_logs**
   - Complete audit trail
   - Security compliance
   - Debugging support

6. **rate_limit_tracking**
   - API rate limit monitoring
   - Prevent throttling

## API Flow

### Typical Bulk Assignment Flow

```
1. User authenticates via OAuth
   ↓
2. Frontend fetches projects from backend
   ↓
3. User selects projects and enters emails
   ↓
4. Frontend calls Preview API
   ↓
5. Backend checks existing access for each user/project
   ↓
6. Frontend displays preview to user
   ↓
7. User confirms, frontend calls Assign API
   ↓
8. Backend creates job execution record
   ↓
9. Backend queues job in BullMQ
   ↓
10. Worker picks up job and starts processing
    ↓
11. Worker processes projects in batches
    ↓
12. Worker updates progress in database
    ↓
13. Frontend polls status API for real-time updates
    ↓
14. Worker completes, final status updated
    ↓
15. Frontend displays results to user
```

## Security Measures

### Authentication & Authorization
- OAuth 2.0 with CSRF protection
- Session-based authentication
- Encrypted token storage (AES-256)
- Account admin verification

### API Security
- Rate limiting (100 requests/15min per IP)
- CORS restrictions
- Helmet security headers
- HTTP-only secure cookies
- Request validation

### Data Protection
- Parameterized SQL queries (prevent injection)
- Input validation (Joi/Zod)
- Sensitive data encryption
- Audit logging for compliance

## Scalability Considerations

### Horizontal Scaling
- Stateless API design (session in DB)
- Multiple worker processes supported
- Redis-backed job queue
- Connection pooling

### Performance Optimizations
- Project data caching
- Batch processing for bulk operations
- Connection pooling (2-10 connections)
- Efficient database indexes

### Rate Limit Management
- Automatic retry with backoff
- Batch size configuration
- Concurrent job limiting
- Redis-based rate tracking

## Monitoring & Observability

### Logging
- Structured logging (Winston)
- Log levels: debug, info, warn, error
- Request/response logging
- Error stack traces

### Metrics
- Job queue metrics
- API response times
- Database query performance
- Rate limit tracking

### Audit Trail
- All user actions logged
- Job execution history
- API error tracking
- Security events

## Deployment Architecture

### Development
```
Local Machine
├── Next.js Dev Server (port 3000)
├── Express API Server (port 3001)
├── BullMQ Worker Process
├── PostgreSQL (Docker, port 5432)
└── Redis (Docker, port 6379)
```

### Production (Recommended)
```
┌─────────────────┐
│   Vercel/CDN    │ ← Next.js Frontend
└────────┬────────┘
         │
┌────────▼────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│ API  │  │ API  │ ← Express servers
│ Node │  │ Node │
└───┬──┘  └──┬───┘
    │        │
┌───▼────────▼───┐
│  Worker Pool   │ ← BullMQ workers (auto-scale)
└───┬────────┬───┘
    │        │
┌───▼──┐  ┌──▼───┐
│ PG   │  │Redis │ ← Managed services
│ RDS  │  │Cache │
└──────┘  └──────┘
```

### Environment Variables

**Backend**:
- `APS_CLIENT_ID`, `APS_CLIENT_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`

**Frontend**:
- `NEXT_PUBLIC_API_URL`

## Future Enhancements

### Phase 2
- Role templates for common configurations
- CSV bulk upload
- Advanced filtering and search
- User groups support

### Phase 3
- Power BI integration
- Azure AD synchronization
- Scheduled user provisioning
- Advanced reporting dashboard

### Phase 4
- Multi-account support
- SSO integration
- Approval workflows
- Custom role definitions

## Development Workflow

### Local Setup
1. Clone repository
2. Start Docker services (PostgreSQL, Redis)
3. Install backend dependencies
4. Run database migrations
5. Install frontend dependencies
6. Start backend dev server
7. Start worker process
8. Start frontend dev server

### Testing Strategy
- Unit tests for services
- Integration tests for API endpoints
- E2E tests for critical flows
- Load testing for bulk operations

## Best Practices

### Code Organization
- Layered architecture (Controller → Service → Repository)
- Separation of concerns
- DRY principle
- Type safety throughout

### Error Handling
- Comprehensive error catching
- User-friendly error messages
- Detailed error logging
- Graceful degradation

### Performance
- Minimize API calls (caching)
- Efficient database queries
- Batch operations
- Connection pooling

## Support & Maintenance

### Monitoring
- Application logs
- Error tracking
- Performance metrics
- User activity

### Backup Strategy
- Daily database backups
- Point-in-time recovery
- 30-day retention
- Monthly restore tests

### Update Process
- Database migrations
- API versioning
- Backward compatibility
- Zero-downtime deployments
