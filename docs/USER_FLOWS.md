# User Flows & Visual Diagrams

Visual guide to understanding how users interact with the ACC Multi-Project User Manager.

## Table of Contents

1. [Authentication Flow](#authentication-flow)
2. [Bulk Assignment Flow](#bulk-assignment-flow)
3. [Job Processing Flow](#job-processing-flow)
4. [History Viewing Flow](#history-viewing-flow)
5. [Error Handling Flow](#error-handling-flow)

---

## Authentication Flow

### User Journey: First-Time Login

```
┌─────────────┐
│   User      │
│ Opens App   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  Redirected to Login    │
│  Page (/login)          │
└──────┬──────────────────┘
       │
       │ Click "Sign in with Autodesk"
       ▼
┌─────────────────────────┐
│  Frontend calls         │
│  GET /api/auth/login    │
└──────┬──────────────────┘
       │
       │ Returns authUrl
       ▼
┌─────────────────────────┐
│  Redirect to APS OAuth  │
│  (developer.api.       │
│   autodesk.com)         │
└──────┬──────────────────┘
       │
       │ User enters credentials
       ▼
┌─────────────────────────┐
│  User Grants            │
│  Permissions            │
└──────┬──────────────────┘
       │
       │ Redirect with code & state
       ▼
┌─────────────────────────┐
│  Backend receives       │
│  GET /api/auth/callback │
└──────┬──────────────────┘
       │
       │ 1. Validate state (CSRF)
       │ 2. Exchange code for token
       │ 3. Get user profile
       │ 4. Store in database
       │ 5. Create session
       ▼
┌─────────────────────────┐
│  Redirect to Dashboard  │
│  (/dashboard)           │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  User Authenticated!    │
│  Session Active         │
└─────────────────────────┘
```

### Subsequent Logins

```
User Opens App
     │
     ▼
Check Session (/api/auth/me)
     │
     ├─ Session Valid ──────► Dashboard
     │
     └─ Session Invalid ────► Login Page
```

---

## Bulk Assignment Flow

### Complete User Journey

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: Project Selection                                    │
└──────────────────────────────────────────────────────────────┘

User on Dashboard
     │
     ▼
┌─────────────────────────┐
│  GET /api/projects      │
│  (Load all projects)    │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Display Project List   │
│  - Search/Filter        │
│  - Multi-Select         │
│  - Select All Option    │
└──────┬──────────────────┘
       │
       │ User selects projects
       ▼
   [Projects Selected]


┌──────────────────────────────────────────────────────────────┐
│ STEP 2: User Email Input                                     │
└──────────────────────────────────────────────────────────────┘

       │
       ▼
┌─────────────────────────┐
│  User enters emails     │
│  (comma or newline      │
│   separated)            │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Client-side validation │
│  - Email format check   │
│  - Duplicate removal    │
│  - Show valid count     │
└──────┬──────────────────┘
       │
       ▼
   [Emails Validated]


┌──────────────────────────────────────────────────────────────┐
│ STEP 3: Role Selection                                       │
└──────────────────────────────────────────────────────────────┘

       │
       ▼
┌─────────────────────────┐
│  GET /api/projects/     │
│  {projectId}/roles      │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Display Available      │
│  Roles                  │
└──────┬──────────────────┘
       │
       │ User selects role
       ▼
   [Role Selected]


┌──────────────────────────────────────────────────────────────┐
│ STEP 4: Preview                                              │
└──────────────────────────────────────────────────────────────┘

       │
       │ User clicks "Preview Assignment"
       ▼
┌─────────────────────────┐
│  POST /api/bulk/preview │
│  {                      │
│    userEmails: [...],   │
│    projectIds: [...]    │
│  }                      │
└──────┬──────────────────┘
       │
       │ Backend checks existing access
       │ for each user in each project
       ▼
┌─────────────────────────┐
│  Return Preview Results │
│  - New users to add     │
│  - Existing users       │
│  - Role updates needed  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Display Preview        │
│  - Summary stats        │
│  - Detailed table       │
│  - Warning if updates   │
│  - Export CSV option    │
└──────┬──────────────────┘
       │
       │ User reviews
       ▼
   User Decision
       │
       ├─ Cancel ──────────► Back to Form
       │
       └─ Confirm ─────────► Continue


┌──────────────────────────────────────────────────────────────┐
│ STEP 5: Execute                                              │
└──────────────────────────────────────────────────────────────┘

       │
       │ User clicks "Confirm & Execute"
       ▼
┌─────────────────────────┐
│  POST /api/bulk/assign  │
│  {                      │
│    userEmails: [...],   │
│    projectIds: [...],   │
│    role: "..."          │
│  }                      │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Backend Creates:       │
│  1. Job execution       │
│     record in DB        │
│  2. Job in BullMQ       │
│     queue               │
└──────┬──────────────────┘
       │
       │ Returns executionId
       ▼
┌─────────────────────────┐
│  Frontend Polls:        │
│  GET /api/bulk/status/  │
│  {executionId}          │
│  (every 2 seconds)      │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Display Execution      │
│  Status                 │
│  - Progress bar         │
│  - Success/fail counts  │
│  - Per-project results  │
│  - Real-time updates    │
└──────┬──────────────────┘
       │
       │ Poll until complete
       ▼
┌─────────────────────────┐
│  Job Complete!          │
│  - Show final results   │
│  - Export CSV option    │
│  - "New Assignment"     │
│    button               │
└─────────────────────────┘
```

---

## Job Processing Flow

### Backend Worker Process

```
┌──────────────────────────────────────────────────────────────┐
│ Worker Process (Separate from API Server)                    │
└──────────────────────────────────────────────────────────────┘

Worker Starts
     │
     ▼
┌─────────────────────────┐
│  Connect to Redis       │
│  Listen for jobs on     │
│  "bulk-user-assignment" │
│  queue                  │
└──────┬──────────────────┘
       │
       │ Job Available
       ▼
┌─────────────────────────┐
│  Pick up Job            │
│  - Get executionId      │
│  - Get user emails      │
│  - Get project IDs      │
│  - Get role             │
│  - Get access token     │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Update DB:             │
│  job_executions.status  │
│  = 'processing'         │
│  started_at = NOW()     │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Create job_results     │
│  records for all        │
│  user+project combos    │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Group into batches     │
│  (5 per batch)          │
└──────┬──────────────────┘
       │
       ▼
   For Each Batch:
       │
       ▼
┌─────────────────────────┐
│  Process 5 operations   │
│  in parallel            │
└──────┬──────────────────┘
       │
       │ For each operation:
       ▼
┌─────────────────────────┐
│  1. Get project info    │
│  2. Check if user       │
│     already has access  │
└──────┬──────────────────┘
       │
       ├─ User exists ────► Update role
       │                    if needed
       │
       └─ User doesn't ───► Add new user
            exist
       │
       ▼
┌─────────────────────────┐
│  Update job_results     │
│  - status               │
│  - action_taken         │
│  - error (if any)       │
│  - completed_at         │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Update job_executions  │
│  - completed_count++    │
│  - success/failed count │
│  - progress %           │
└──────┬──────────────────┘
       │
       ▼
   More Batches?
       │
       ├─ Yes ──────► Wait 500ms ──► Next Batch
       │              (rate limit
       │               protection)
       │
       └─ No ───────► Continue
              │
              ▼
┌─────────────────────────┐
│  Calculate final status │
│  - completed            │
│  - partial_success      │
│  - failed               │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Update job_executions  │
│  - status = final       │
│  - completed_at = NOW() │
└──────┬──────────────────┘
       │
       ▼
   Job Complete!
```

### Error Handling in Worker

```
API Call to APS
     │
     ▼
   Success? ─── Yes ──► Continue
     │
     No
     │
     ▼
Check Error Type
     │
     ├─ 429 (Rate Limit) ──► Wait retry-after time ──► Retry
     │
     ├─ 5xx (Server Error) ─► Wait with backoff ──────► Retry
     │                         (up to 3 times)
     │
     └─ 4xx (Client Error) ──► Log error ──────────────► Mark failed
                                                         Continue
```

---

## History Viewing Flow

```
User clicks "History"
     │
     ▼
┌─────────────────────────┐
│  Navigate to            │
│  /history               │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  GET /api/bulk/history  │
│  ?limit=50&offset=0     │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Display Table:         │
│  - Status               │
│  - Start/End times      │
│  - Success/Fail counts  │
│  - View button          │
└──────┬──────────────────┘
       │
       │ User clicks "View"
       ▼
┌─────────────────────────┐
│  GET /api/bulk/status/  │
│  {executionId}          │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Show ExecutionStatus   │
│  component with full    │
│  details                │
└─────────────────────────┘
```

---

## Error Handling Flow

### Frontend Error Handling

```
API Call
     │
     ▼
   Success? ─── Yes ──► Process response
     │
     No
     │
     ▼
Check Status Code
     │
     ├─ 401 ──► Redirect to login
     │
     ├─ 400 ──► Show validation error
     │           (Alert component)
     │
     ├─ 429 ──► Show "Too many requests"
     │           with retry suggestion
     │
     ├─ 500 ──► Show "Server error"
     │           with retry button
     │
     └─ Network Error ──► Show "Connection lost"
                          with retry button
```

### Backend Error Handling

```
Request Received
     │
     ▼
Authentication? ─ Fail ──► Return 401
     │
     Pass
     │
     ▼
Validation? ─── Fail ──► Return 400 with details
     │
     Pass
     │
     ▼
Business Logic
     │
     ├─ Success ──────────────────► Return 200 with data
     │
     ├─ APS API Error ─────────────► Return 500 with message
     │                                Log error
     │
     ├─ Database Error ────────────► Return 500
     │                                Log error
     │
     └─ Unexpected Error ──────────► Return 500
                                     Log error with stack trace
                                     Send to monitoring (if configured)
```

---

## State Transitions

### Job Execution States

```
      [pending]
          │
          │ Worker picks up
          ▼
    [processing]
          │
          │ Completes
          ▼
     All Success? ─── Yes ──► [completed]
          │
          No
          │
          ▼
     Any Success? ─── Yes ──► [partial_success]
          │
          No
          │
          ▼
      [failed]
```

### Job Result States

```
     [pending]
         │
         │ Worker starts
         ▼
   [processing]
         │
         ├─ User already ───────► [skipped]
         │  has same role
         │
         ├─ Successfully ───────► [success]
         │  added/updated
         │
         └─ Error occurred ─────► [failed]
```

---

## Data Flow Diagram

### Complete System Data Flow

```
┌─────────┐
│ Browser │
└────┬────┘
     │
     │ HTTPS
     ▼
┌────────────────┐
│   Next.js      │
│   Frontend     │
└────┬───────────┘
     │
     │ REST API
     │ /api/*
     ▼
┌────────────────┐         ┌──────────┐
│   Express      │────────►│PostgreSQL│
│   Backend      │◄────────│ Database │
└────┬───────────┘         └──────────┘
     │
     │ Add Job
     ▼
┌────────────────┐         ┌──────────┐
│    BullMQ      │────────►│  Redis   │
│    Queue       │◄────────│  Store   │
└────┬───────────┘         └──────────┘
     │
     │ Process Job
     ▼
┌────────────────┐
│  Job Worker    │
│   Process      │
└────┬───────────┘
     │
     │ APS API Calls
     ▼
┌────────────────┐
│   Autodesk     │
│  Platform      │
│  Services      │
└────────────────┘
```

---

## UI Component Hierarchy

### Dashboard Page Component Tree

```
DashboardPage
│
├─ Header
│  ├─ Logo
│  ├─ User Info
│  └─ Actions (History, Logout)
│
└─ Main Content
   │
   ├─ Step: Form
   │  │
   │  ├─ ProjectSelector
   │  │  ├─ Search Input
   │  │  ├─ Select All Button
   │  │  └─ Project Cards (map)
   │  │
   │  ├─ UserEmailInput
   │  │  ├─ Textarea
   │  │  ├─ Validation Display
   │  │  └─ Help Text
   │  │
   │  └─ RoleSelector
   │     └─ Role Cards (map)
   │
   ├─ Step: Preview
   │  │
   │  └─ PreviewResults
   │     ├─ Summary Stats
   │     ├─ Filter Buttons
   │     ├─ Results Table
   │     └─ Action Buttons
   │
   └─ Step: Executing
      │
      └─ ExecutionStatus
         ├─ Progress Bar
         ├─ Stats Grid
         ├─ Timing Info
         ├─ Filter Buttons
         └─ Results Table
```

---

## Security Flow

### Request Authentication & Authorization

```
HTTP Request
     │
     ▼
┌─────────────────────────┐
│  CORS Middleware        │
│  - Check origin         │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Helmet Middleware      │
│  - Security headers     │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Session Middleware     │
│  - Load session from DB │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Rate Limit Middleware  │
│  - Check Redis counter  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  requireAuth Middleware │
│  - Verify session       │
└──────┬──────────────────┘
       │
       │ Authenticated
       ▼
┌─────────────────────────┐
│  Route Handler          │
│  (Controller)           │
└─────────────────────────┘
```

---

## Monitoring & Observability

### Log Flow

```
Application Event
     │
     ▼
Winston Logger
     │
     ├─ Console ────────► Development output
     │
     ├─ File ───────────► ./logs/combined.log
     │                    ./logs/error.log
     │
     └─ External ───────► CloudWatch / Datadog
                          (if configured)
```

### Metrics Collection

```
Application Metrics
     │
     ├─ Request Count ──────► Rate limiting
     │
     ├─ Response Time ──────► Performance monitoring
     │
     ├─ Error Rate ─────────► Alerting
     │
     ├─ Job Queue Length ───► Capacity planning
     │
     └─ Database Connections ► Resource monitoring
```

---

## Summary

These flows represent the complete user journey through the ACC Multi-Project User Manager, from initial authentication through to viewing execution history. Each flow includes:

- User interactions
- API calls
- Backend processing
- Database updates
- Error handling
- State transitions

Understanding these flows will help with:
- Debugging issues
- Adding new features
- Performance optimization
- User training
- System monitoring
