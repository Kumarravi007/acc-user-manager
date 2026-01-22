-- Migration: Initial Schema
-- Created: 2025-01-22
-- Description: Creates all initial tables for ACC Multi-Project User Manager

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE job_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'partial_success',
    'failed',
    'cancelled'
);

CREATE TYPE result_status AS ENUM (
    'pending',
    'processing',
    'success',
    'skipped',
    'failed'
);

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

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aps_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    account_id VARCHAR(255),
    is_account_admin BOOLEAN DEFAULT FALSE,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_aps_user_id ON users(aps_user_id);
CREATE INDEX idx_users_account_id ON users(account_id);

-- Projects cache table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) UNIQUE NOT NULL,
    project_name VARCHAR(500) NOT NULL,
    project_type VARCHAR(100),
    status VARCHAR(50),
    region VARCHAR(50),
    last_synced_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_projects_project_id ON projects(project_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Job executions table
CREATE TABLE job_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    job_type VARCHAR(50) DEFAULT 'bulk_user_assignment',
    status job_status DEFAULT 'pending',

    target_user_emails TEXT[],
    target_project_ids TEXT[],
    assigned_role VARCHAR(100),

    total_projects INTEGER NOT NULL,
    completed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,

    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_duration_seconds INTEGER,

    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_executions_user_id ON job_executions(user_id);
CREATE INDEX idx_job_executions_status ON job_executions(status);
CREATE INDEX idx_job_executions_created_at ON job_executions(created_at DESC);

-- Job results table
CREATE TABLE job_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES job_executions(id) ON DELETE CASCADE,

    project_id VARCHAR(255) NOT NULL,
    project_name VARCHAR(500),
    user_email VARCHAR(255) NOT NULL,

    status result_status DEFAULT 'pending',

    previous_role VARCHAR(100),
    assigned_role VARCHAR(100),
    action_taken VARCHAR(50),

    error_code VARCHAR(100),
    error_message TEXT,

    api_request_id VARCHAR(255),
    api_response_code INTEGER,

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

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    execution_id UUID REFERENCES job_executions(id) ON DELETE SET NULL,

    action audit_action NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),

    details JSONB,

    ip_address INET,
    user_agent TEXT,

    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_execution_id ON audit_logs(execution_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN(details);

-- Rate limit tracking table
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

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_executions_updated_at BEFORE UPDATE ON job_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_results_updated_at BEFORE UPDATE ON job_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limit_tracking_updated_at BEFORE UPDATE ON rate_limit_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS (for reporting)
-- ============================================================================

-- View: Job execution summary
CREATE OR REPLACE VIEW v_job_execution_summary AS
SELECT
    je.id,
    je.status,
    je.total_projects,
    je.success_count,
    je.failed_count,
    ROUND(EXTRACT(EPOCH FROM (je.completed_at - je.started_at)))::INTEGER as duration_seconds,
    je.started_at,
    je.completed_at,
    u.email as initiated_by,
    u.name as user_name
FROM job_executions je
LEFT JOIN users u ON je.user_id = u.id;

-- View: Recent failures for retry
CREATE OR REPLACE VIEW v_failed_operations AS
SELECT
    jr.id,
    jr.execution_id,
    jr.project_name,
    jr.user_email,
    jr.error_message,
    jr.error_code,
    je.retry_count,
    jr.created_at
FROM job_results jr
JOIN job_executions je ON jr.execution_id = je.id
WHERE jr.status = 'failed'
  AND je.retry_count < 3
ORDER BY jr.created_at DESC;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- No initial data needed for MVP

COMMIT;
