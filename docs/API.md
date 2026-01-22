# API Documentation

## Base URL

```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

## Authentication

All API requests (except auth endpoints) require an authenticated session via cookies.

### Session Cookie

The application uses session-based authentication with secure HTTP-only cookies.

---

## Endpoints

### Authentication

#### 1. Initiate Login

Start the OAuth 2.0 flow to authenticate with Autodesk.

**Endpoint:** `GET /auth/login`

**Response:**
```json
{
  "authUrl": "https://developer.api.autodesk.com/authentication/v2/authorize?..."
}
```

**Usage:**
Redirect user to the `authUrl` to complete authentication.

---

#### 2. OAuth Callback

Handle the OAuth callback (automatically handled by backend).

**Endpoint:** `GET /auth/callback?code=xxx&state=xxx`

**Response:**
Redirects to frontend dashboard on success, or login page with error on failure.

---

#### 3. Get Current User

Get the authenticated user's session information.

**Endpoint:** `GET /auth/me`

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "aps_user_id": "string",
    "email": "user@example.com",
    "name": "John Doe",
    "account_id": "acc-account-id",
    "is_account_admin": true
  }
}
```

---

#### 4. Logout

End the user session.

**Endpoint:** `POST /auth/logout`

**Response:**
```json
{
  "success": true
}
```

---

### Projects

#### 5. List Projects

Get all projects for the authenticated user's account.

**Endpoint:** `GET /projects`

**Response:**
```json
{
  "projects": [
    {
      "id": "project-id",
      "name": "Project Name",
      "status": "active",
      "platform": "ACC"
    }
  ]
}
```

---

#### 6. Get Project Details

Get detailed information about a specific project.

**Endpoint:** `GET /projects/:projectId`

**Response:**
```json
{
  "project": {
    "id": "project-id",
    "name": "Project Name",
    "accountId": "account-id",
    "status": "active",
    "platform": "ACC",
    ...
  }
}
```

---

#### 7. Get Project Users

List all users in a project.

**Endpoint:** `GET /projects/:projectId/users`

**Response:**
```json
{
  "users": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "name": "John Doe",
      "roleIds": ["role-id-1"],
      "products": [...]
    }
  ]
}
```

---

#### 8. Get Project Roles

Get available roles for a project.

**Endpoint:** `GET /projects/:projectId/roles`

**Response:**
```json
{
  "roles": [
    {
      "id": "role-id",
      "name": "Project Administrator",
      "description": "Full project access"
    }
  ]
}
```

---

### Bulk Operations

#### 9. Preview Bulk Assignment

Preview what will happen when adding users to projects.

**Endpoint:** `POST /bulk/preview`

**Request Body:**
```json
{
  "userEmails": ["user1@example.com", "user2@example.com"],
  "projectIds": ["project-id-1", "project-id-2"]
}
```

**Response:**
```json
{
  "preview": [
    {
      "userEmail": "user1@example.com",
      "projectId": "project-id-1",
      "projectName": "Project Alpha",
      "currentAccess": {
        "hasAccess": false,
        "currentRole": null
      },
      "willBeAdded": true,
      "willBeUpdated": false
    },
    {
      "userEmail": "user2@example.com",
      "projectId": "project-id-1",
      "projectName": "Project Alpha",
      "currentAccess": {
        "hasAccess": true,
        "currentRole": "Member"
      },
      "willBeAdded": false,
      "willBeUpdated": true
    }
  ],
  "summary": {
    "totalOperations": 4,
    "newUsers": 2,
    "updates": 2
  }
}
```

---

#### 10. Execute Bulk Assignment

Add users to multiple projects with specified role.

**Endpoint:** `POST /bulk/assign`

**Request Body:**
```json
{
  "userEmails": ["user1@example.com", "user2@example.com"],
  "projectIds": ["project-id-1", "project-id-2"],
  "role": "role-id"
}
```

**Response:**
```json
{
  "executionId": "uuid",
  "status": "pending",
  "totalProjects": 4,
  "message": "Job queued successfully"
}
```

**Notes:**
- The operation is asynchronous
- Use the `executionId` to track progress
- Invalid emails will return 400 error with list of invalid emails

---

#### 11. Get Job Status

Get real-time status of a bulk assignment job.

**Endpoint:** `GET /bulk/status/:executionId`

**Response:**
```json
{
  "id": "execution-id",
  "status": "processing",
  "progress": {
    "total": 10,
    "completed": 6,
    "success": 5,
    "failed": 1,
    "percentage": 60
  },
  "results": [
    {
      "id": "result-id",
      "projectId": "project-id",
      "projectName": "Project Alpha",
      "userEmail": "user@example.com",
      "status": "success",
      "previousRole": null,
      "assignedRole": "role-id",
      "actionTaken": "added",
      "errorMessage": null,
      "completedAt": "2025-01-22T10:30:00Z"
    },
    {
      "id": "result-id-2",
      "projectId": "project-id-2",
      "projectName": "Project Beta",
      "userEmail": "user@example.com",
      "status": "failed",
      "previousRole": null,
      "assignedRole": "role-id",
      "actionTaken": null,
      "errorMessage": "User not found in account",
      "completedAt": "2025-01-22T10:30:05Z"
    }
  ],
  "startedAt": "2025-01-22T10:29:00Z",
  "completedAt": null,
  "estimatedTimeRemaining": 120
}
```

**Job Statuses:**
- `pending` - Job queued, not started
- `processing` - Job in progress
- `completed` - All operations succeeded
- `partial_success` - Some operations failed
- `failed` - All operations failed
- `cancelled` - Job was cancelled

**Result Statuses:**
- `pending` - Not started
- `processing` - In progress
- `success` - Successfully added/updated
- `skipped` - User already had access with same role
- `failed` - Operation failed

---

#### 12. Get Job History

Get history of bulk assignment jobs for the authenticated user.

**Endpoint:** `GET /bulk/history?limit=20&offset=0`

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "executions": [
    {
      "id": "execution-id",
      "status": "completed",
      "total_projects": 10,
      "success_count": 9,
      "failed_count": 1,
      "started_at": "2025-01-22T10:00:00Z",
      "completed_at": "2025-01-22T10:05:00Z",
      "created_at": "2025-01-22T09:59:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not authorized for this action |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Rate Limiting

- **Window:** 15 minutes
- **Max Requests:** 100 per window per IP
- **Headers:**
  - `X-RateLimit-Limit`: Maximum requests
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

When rate limited, you'll receive a 429 response:

```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

---

## Webhooks (Future)

Future versions may include webhook support for real-time job status updates.

---

## SDK Examples

### JavaScript/TypeScript

```typescript
// Initialize login
const { authUrl } = await fetch('/api/auth/login').then(r => r.json());
window.location.href = authUrl;

// Get projects
const { projects } = await fetch('/api/projects', {
  credentials: 'include'
}).then(r => r.json());

// Preview bulk assignment
const preview = await fetch('/api/bulk/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    userEmails: ['user@example.com'],
    projectIds: ['project-id']
  })
}).then(r => r.json());

// Execute bulk assignment
const { executionId } = await fetch('/api/bulk/assign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    userEmails: ['user@example.com'],
    projectIds: ['project-id'],
    role: 'role-id'
  })
}).then(r => r.json());

// Poll for status
const pollStatus = async (executionId: string) => {
  const status = await fetch(`/api/bulk/status/${executionId}`, {
    credentials: 'include'
  }).then(r => r.json());

  if (status.status === 'processing') {
    setTimeout(() => pollStatus(executionId), 2000);
  } else {
    console.log('Job completed:', status);
  }
};
```

---

## Support

For API issues or questions, please open an issue on GitHub.
