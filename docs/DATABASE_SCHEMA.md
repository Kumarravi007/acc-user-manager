# Database Schema

## Overview

PostgreSQL database schema for ACC Multi-Project User Manager with full audit trail and job tracking.

## Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────┐
│   users     │         │  job_executions  │
├─────────────┤         ├──────────────────┤
│ id          │────┐    │ id               │
│ aps_user_id │    │    │ user_id (FK)     │
│ email       │    │    │ status           │
│ name        │    │    │ total_projects   │
│ ...         │    │    │ completed_count  │
└─────────────┘    │    │ failed_count     │
                   │    │ ...              │
                   │    └────────┬─────────┘
                   │             │
                   │             │
                   └─────────────┼────────┐
                                 │        │
                   ┌─────────────▼──┐  ┌──▼──────────┐
                   │  job_results   │  │ audit_logs  │
                   ├────────────────┤  ├─────────────┤
                   │ id             │  │ id          │
                   │ execution_id(FK│  │ user_id (FK)│
                   │ project_id     │  │ action      │
                   │ user_email     │  │ details     │
                   │ status         │  │ ...         │
                   │ ...            │  └─────────────┘
                   └────────────────┘
```

## Tables

### 1. users

Stores authenticated ACC users who use this application.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aps_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    account_id VARCHAR(255), -- ACC Account ID
    is_account_admin BOOLEAN DEFAULT FALSE,
    access_token_encrypted TEXT, -- Encrypted OAuth token
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_aps_user_id ON users(aps_user_id);
CREATE INDEX idx_users_account_id ON users(account_id);
```

**Purpose**: Track authenticated users and store encrypted OAuth tokens.

### 2. projects (Cache)

Cached ACC project data to reduce API calls.

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) UNIQUE NOT NULL, -- ACC Project ID
    project_name VARCHAR(500) NOT NULL,
    project_type VARCHAR(100), -- BIM360, ACC
    status VARCHAR(50), -- active, archived
    region VARCHAR(50),
    last_synced_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_projects_project_id ON projects(project_id);
CREATE INDEX idx_projects_status ON projects(status);
```

**Purpose**: Cache project metadata to improve UI performance.

### 3. job_executions

Tracks bulk user assignment operations.

```sql
CREATE TYPE job_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'partial_success',
    'failed',
    'cancelled'
);

CREATE TABLE job_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    job_type VARCHAR(50) DEFAULT 'bulk_user_assignment',
    status job_status DEFAULT 'pending',

    -- Input data
    target_user_emails TEXT[], -- Users to be added
    target_project_ids TEXT[], -- Projects to add users to
    assigned_role VARCHAR(100), -- Role to assign

    -- Progress tracking
    total_projects INTEGER NOT NULL,
    completed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_duration_seconds INTEGER,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_executions_user_id ON job_executions(user_id);
CREATE INDEX idx_job_executions_status ON job_executions(status);
CREATE INDEX idx_job_executions_created_at ON job_executions(created_at DESC);
```

**Purpose**: Track overall execution of bulk operations.

### 4. job_results

Per-project results for each job execution.

```sql
CREATE TYPE result_status AS ENUM (
    'pending',
    'processing',
    'success',
    'skipped', -- User already has access
    'failed'
);

CREATE TABLE job_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES job_executions(id) ON DELETE CASCADE,

    -- Target info
    project_id VARCHAR(255) NOT NULL,
    project_name VARCHAR(500),
    user_email VARCHAR(255) NOT NULL,

    -- Status
    status result_status DEFAULT 'pending',

    -- Details
    previous_role VARCHAR(100), -- If user already had access
    assigned_role VARCHAR(100), -- Role assigned/attempted
    action_taken VARCHAR(50), -- 'added', 'updated', 'skipped', 'failed'

    -- Error info
    error_code VARCHAR(100),
    error_message TEXT,

    -- API details
    api_request_id VARCHAR(255), -- APS request ID for debugging
    api_response_code INTEGER,

    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_results_execution_id ON job_results(execution_id);
CREATE INDEX idx_job_results_status ON job_results(status);
CREATE INDEX idx_job_results_project_id ON job_results(project_id);
CREATE INDEX idx_job_results_user_email ON job_results(user_email);
```

**Purpose**: Track individual project-level results for detailed reporting.

### 5. audit_logs

Complete audit trail for compliance and debugging.

```sql
CREATE TYPE audit_action AS ENUM (
    'user_login',
    'user_logout',
    'projects_fetched',
    'user_preview',
    'job_created',
    'job_started',
    'job_completed',
    'job_failed',
    'user_added_to_project',
    'user_role_updated',
    'api_error',
    'rate_limit_hit'
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    execution_id UUID REFERENCES job_executions(id) ON DELETE SET NULL,

    action audit_action NOT NULL,
    resource_type VARCHAR(50), -- 'project', 'user', 'job'
    resource_id VARCHAR(255),

    details JSONB, -- Flexible JSON for additional context

    -- Context
    ip_address INET,
    user_agent TEXT,

    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_execution_id ON audit_logs(execution_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN(details);
```

**Purpose**: Comprehensive audit trail for security, compliance, and debugging.

### 6. rate_limit_tracking

Track API rate limits to prevent throttling.

```sql
CREATE TABLE rate_limit_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_endpoint VARCHAR(255) NOT NULL,
    account_id VARCHAR(255),

    requests_count INTEGER DEFAULT 0,
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,

    limit_remaining INTEGER,
    limit_total INTEGER,
    reset_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_endpoint ON rate_limit_tracking(api_endpoint, window_start);
CREATE INDEX idx_rate_limit_account ON rate_limit_tracking(account_id);
```

**Purpose**: Monitor and respect APS API rate limits.

## Sample Queries

### Get Job Execution Summary

```sql
SELECT
    je.id,
    je.status,
    je.total_projects,
    je.success_count,
    je.failed_count,
    je.completed_at - je.started_at as duration,
    u.email as initiated_by
FROM job_executions je
LEFT JOIN users u ON je.user_id = u.id
WHERE je.created_at >= NOW() - INTERVAL '7 days'
ORDER BY je.created_at DESC;
```

### Get Failed Operations for Retry

```sql
SELECT
    jr.id,
    jr.execution_id,
    jr.project_name,
    jr.user_email,
    jr.error_message,
    je.retry_count
FROM job_results jr
JOIN job_executions je ON jr.execution_id = je.id
WHERE jr.status = 'failed'
  AND je.retry_count < 3
  AND je.created_at >= NOW() - INTERVAL '1 day'
ORDER BY jr.created_at DESC;
```

### Audit Report - User Activity

```sql
SELECT
    u.email,
    al.action,
    al.resource_type,
    al.details,
    al.created_at
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE al.created_at >= NOW() - INTERVAL '30 days'
  AND al.action IN ('job_created', 'user_added_to_project')
ORDER BY al.created_at DESC;
```

### Project Access Matrix

```sql
SELECT
    jr.project_name,
    jr.user_email,
    jr.assigned_role,
    jr.status,
    jr.completed_at
FROM job_results jr
WHERE jr.status = 'success'
  AND jr.completed_at >= NOW() - INTERVAL '90 days'
ORDER BY jr.project_name, jr.user_email;
```

## Data Retention Policy

- **audit_logs**: Retain for 2 years, then archive
- **job_executions**: Retain for 1 year
- **job_results**: Retain for 1 year
- **projects cache**: Refresh every 24 hours
- **rate_limit_tracking**: Retain for 7 days

## Backup Strategy

- Daily automated backups
- Point-in-time recovery enabled
- Backup retention: 30 days
- Test restore monthly

## Migration Strategy

Migrations managed via `node-pg-migrate` or `Prisma`.

Initial migration creates all tables with proper indexes and constraints.
