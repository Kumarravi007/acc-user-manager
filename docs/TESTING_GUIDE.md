# Testing Guide

Comprehensive testing strategy for ACC Multi-Project User Manager.

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Unit Testing](#unit-testing)
3. [Integration Testing](#integration-testing)
4. [End-to-End Testing](#end-to-end-testing)
5. [Load Testing](#load-testing)
6. [Manual Testing Checklist](#manual-testing-checklist)
7. [Test Data Setup](#test-data-setup)

---

## Testing Strategy

### Test Pyramid

```
        E2E Tests (5%)
    ┌──────────────────┐
    │  User Flows      │
    └──────────────────┘
  ┌────────────────────────┐
  │ Integration Tests (30%)│
  │  API Endpoints         │
  └────────────────────────┘
┌──────────────────────────────┐
│   Unit Tests (65%)           │
│   Services, Utils, Components│
└──────────────────────────────┘
```

### Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: All API endpoints
- **E2E Tests**: Critical user flows
- **Load Tests**: Performance benchmarks

---

## Unit Testing

### Backend Unit Tests (Jest)

**Install Dependencies:**
```bash
cd backend
npm install --save-dev jest ts-jest @types/jest
```

**Jest Configuration:**
```typescript
// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/app.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

**Example: Test APS Auth Service**
```typescript
// backend/src/services/aps/__tests__/auth.service.test.ts
import { APSAuthService } from '../auth.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('APSAuthService', () => {
  let authService: APSAuthService;

  beforeEach(() => {
    authService = new APSAuthService();
  });

  describe('generateAuthUrl', () => {
    it('should generate valid authorization URL', () => {
      const state = authService.generateState();
      const authUrl = authService.generateAuthUrl(state);

      expect(authUrl).toContain('https://developer.api.autodesk.com');
      expect(authUrl).toContain('client_id=');
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('response_type=code');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange code for access token', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await authService.exchangeCodeForToken('test-code');

      expect(result.access_token).toBe('test-access-token');
      expect(result.refresh_token).toBe('test-refresh-token');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/authentication/v2/token'),
        expect.any(URLSearchParams),
        expect.any(Object)
      );
    });

    it('should handle authentication errors', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          },
        },
      });

      await expect(
        authService.exchangeCodeForToken('invalid-code')
      ).rejects.toThrow();
    });
  });

  describe('generateState', () => {
    it('should generate unique state values', () => {
      const state1 = authService.generateState();
      const state2 = authService.generateState();

      expect(state1).not.toBe(state2);
      expect(state1.length).toBeGreaterThan(0);
    });
  });
});
```

**Example: Test Utilities**
```typescript
// backend/src/utils/__tests__/helpers.test.ts
import {
  encrypt,
  decrypt,
  validateEmail,
  validateEmails,
  chunkArray,
  calculatePercentage,
} from '../helpers';

describe('Utility Functions', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalData = 'sensitive-token-data';
      const encrypted = encrypt(originalData);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(originalData);
      expect(decrypted).toBe(originalData);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@company.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
    });
  });

  describe('validateEmails', () => {
    it('should separate valid and invalid emails', () => {
      const emails = 'user1@test.com\ninvalid\nuser2@test.com';
      const result = validateEmails(emails);

      expect(result.valid).toEqual(['user1@test.com', 'user2@test.com']);
      expect(result.invalid).toEqual(['invalid']);
    });

    it('should remove duplicates', () => {
      const emails = 'user@test.com\nuser@test.com';
      const result = validateEmails(emails);

      expect(result.valid).toEqual(['user@test.com']);
    });
  });

  describe('chunkArray', () => {
    it('should chunk array into specified sizes', () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      const chunks = chunkArray(array, 3);

      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(1, 3)).toBe(33);
      expect(calculatePercentage(0, 100)).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(calculatePercentage(0, 0)).toBe(0);
      expect(calculatePercentage(100, 100)).toBe(100);
    });
  });
});
```

**Run Tests:**
```bash
cd backend
npm test
npm test -- --coverage
npm test -- --watch
```

---

## Integration Testing

### API Integration Tests

**Setup:**
```typescript
// backend/src/__tests__/setup.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';

let pool: Pool;
let redis: Redis;

beforeAll(async () => {
  // Use test database
  pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });

  redis = new Redis(process.env.TEST_REDIS_URL);

  // Run migrations
  // ... migration code
});

afterAll(async () => {
  await pool.end();
  await redis.quit();
});

beforeEach(async () => {
  // Clean database before each test
  await pool.query('TRUNCATE users, projects, job_executions, job_results CASCADE');
});

export { pool, redis };
```

**Example: Test Auth Endpoints**
```typescript
// backend/src/controllers/__tests__/auth.controller.test.ts
import request from 'supertest';
import app from '../../app';
import { pool } from '../setup';

describe('Auth Controller', () => {
  describe('GET /api/auth/login', () => {
    it('should return authorization URL', async () => {
      const response = await request(app)
        .get('/api/auth/login')
        .expect(200);

      expect(response.body).toHaveProperty('authUrl');
      expect(response.body.authUrl).toContain('developer.api.autodesk.com');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 if not authenticated', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should return user data if authenticated', async () => {
      // Create test user
      const user = await pool.query(
        'INSERT INTO users (aps_user_id, email, name) VALUES ($1, $2, $3) RETURNING *',
        ['test-user-id', 'test@example.com', 'Test User']
      );

      // Create session (implementation depends on session middleware)
      const agent = request.agent(app);
      // ... authenticate agent

      const response = await agent
        .get('/api/auth/me')
        .expect(200);

      expect(response.body.user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
      });
    });
  });
});
```

**Example: Test Bulk Operations**
```typescript
// backend/src/controllers/__tests__/bulk-operations.controller.test.ts
import request from 'supertest';
import app from '../../app';
import { pool } from '../setup';

describe('Bulk Operations Controller', () => {
  let authenticatedAgent: any;
  let testUser: any;

  beforeEach(async () => {
    // Create and authenticate test user
    testUser = await createTestUser();
    authenticatedAgent = await authenticateAgent(testUser);
  });

  describe('POST /api/bulk/preview', () => {
    it('should return preview results', async () => {
      const response = await authenticatedAgent
        .post('/api/bulk/preview')
        .send({
          userEmails: ['user1@test.com', 'user2@test.com'],
          projectIds: ['project-1', 'project-2'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('preview');
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary.totalOperations).toBe(4);
    });

    it('should validate email addresses', async () => {
      const response = await authenticatedAgent
        .post('/api/bulk/preview')
        .send({
          userEmails: ['invalid-email'],
          projectIds: ['project-1'],
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid email');
    });
  });

  describe('POST /api/bulk/assign', () => {
    it('should create job execution', async () => {
      const response = await authenticatedAgent
        .post('/api/bulk/assign')
        .send({
          userEmails: ['user@test.com'],
          projectIds: ['project-1'],
          role: 'project_admin',
        })
        .expect(200);

      expect(response.body).toHaveProperty('executionId');
      expect(response.body.status).toBe('pending');

      // Verify job was created in database
      const job = await pool.query(
        'SELECT * FROM job_executions WHERE id = $1',
        [response.body.executionId]
      );

      expect(job.rows[0].status).toBe('pending');
    });
  });
});
```

**Run Integration Tests:**
```bash
TEST_DATABASE_URL=postgresql://... npm test -- --testPathPattern=integration
```

---

## End-to-End Testing

### Using Playwright

**Install:**
```bash
cd frontend
npm install --save-dev @playwright/test
npx playwright install
```

**Configuration:**
```typescript
// frontend/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Example: Login Flow**
```typescript
// frontend/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect to login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should complete OAuth login flow', async ({ page }) => {
    await page.goto('/login');

    // Click login button
    await page.click('text=Sign in with Autodesk');

    // Wait for Autodesk login page
    await expect(page).toHaveURL(/autodesk\.com/);

    // Fill in credentials (use test account)
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');

    // Should redirect back to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });
});
```

**Example: Bulk Assignment Flow**
```typescript
// frontend/e2e/bulk-assignment.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Bulk Assignment', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await loginAsTestUser(page);
    await page.goto('/dashboard');
  });

  test('should complete bulk assignment flow', async ({ page }) => {
    // Select projects
    await page.click('text=Project Alpha');
    await page.click('text=Project Beta');

    // Enter user emails
    await page.fill('textarea[placeholder*="email"]', 'user1@test.com\nuser2@test.com');

    // Select role
    await page.click('text=Project Administrator');

    // Preview
    await page.click('text=Preview Assignment');
    await expect(page.locator('text=Preview Results')).toBeVisible();

    // Verify preview shows correct data
    await expect(page.locator('text=4 Total Operations')).toBeVisible();

    // Execute
    await page.click('text=Confirm & Execute');

    // Should show execution status
    await expect(page.locator('text=Execution Status')).toBeVisible();

    // Wait for completion (with timeout)
    await expect(page.locator('text=COMPLETED')).toBeVisible({ timeout: 30000 });
  });

  test('should handle validation errors', async ({ page }) => {
    // Try to preview without selecting projects
    await page.fill('textarea[placeholder*="email"]', 'user@test.com');
    await page.click('text=Preview Assignment');

    // Should show validation alert
    await expect(page.locator('text=Please select at least one project')).toBeVisible();
  });
});
```

**Run E2E Tests:**
```bash
cd frontend
npx playwright test
npx playwright test --headed
npx playwright test --debug
```

---

## Load Testing

### Using Artillery

**Install:**
```bash
npm install -g artillery
```

**Load Test Configuration:**
```yaml
# load-test.yml
config:
  target: "https://api.yourdomain.com"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Spike"

scenarios:
  - name: "Get projects"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            username: "{{ $processEnvironment.TEST_USER }}"
            password: "{{ $processEnvironment.TEST_PASSWORD }}"
          capture:
            - json: "$.token"
              as: "token"
      - get:
          url: "/api/projects"
          headers:
            Authorization: "Bearer {{ token }}"

  - name: "Bulk assignment"
    weight: 2
    flow:
      - post:
          url: "/api/bulk/assign"
          json:
            userEmails: ["load-test-{{ $randomString() }}@test.com"]
            projectIds: ["{{ $randomString() }}"]
            role: "project_admin"
          headers:
            Authorization: "Bearer {{ token }}"
```

**Run Load Test:**
```bash
artillery run load-test.yml
artillery run --output report.json load-test.yml
artillery report report.json
```

**Performance Benchmarks:**
- API response time p95: < 500ms
- API response time p99: < 1000ms
- Throughput: 100 req/sec minimum
- Error rate: < 1%

---

## Manual Testing Checklist

### Pre-Release Testing

**Authentication:**
- [ ] Login with valid Autodesk credentials
- [ ] Login with invalid credentials (should fail gracefully)
- [ ] Logout functionality
- [ ] Session persistence across page refreshes
- [ ] Session expiry handling

**Project Selection:**
- [ ] Projects load correctly
- [ ] Search functionality works
- [ ] Multi-select works
- [ ] Select all / Deselect all
- [ ] Selected count updates

**User Input:**
- [ ] Email validation (valid/invalid)
- [ ] Duplicate email handling
- [ ] Multiple email formats (comma, newline)
- [ ] Large number of emails (100+)

**Role Selection:**
- [ ] Roles load for selected project
- [ ] Role selection updates
- [ ] Role descriptions visible

**Preview:**
- [ ] Preview shows correct user count
- [ ] Preview shows correct project count
- [ ] Existing access detected correctly
- [ ] New vs update actions labeled correctly
- [ ] CSV export works

**Execution:**
- [ ] Job starts successfully
- [ ] Progress updates in real-time
- [ ] Success/failure counts update
- [ ] Individual results display correctly
- [ ] Execution completes successfully
- [ ] Errors are handled gracefully
- [ ] CSV export works

**History:**
- [ ] Past executions display
- [ ] Execution details viewable
- [ ] Filtering works
- [ ] Pagination works (if applicable)

**Error Handling:**
- [ ] Network errors handled
- [ ] API errors displayed to user
- [ ] Rate limit errors handled
- [ ] Validation errors clear

**Cross-Browser:**
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

**Mobile:**
- [ ] Responsive layout
- [ ] Touch interactions
- [ ] Mobile navigation

---

## Test Data Setup

### Create Test Users in APS

1. Create test Autodesk accounts
2. Invite to test ACC account
3. Assign different roles

### Seed Test Database

```sql
-- Create test user
INSERT INTO users (aps_user_id, email, name, account_id, is_account_admin)
VALUES ('test-user-1', 'test@example.com', 'Test User', 'test-account', true);

-- Create test projects
INSERT INTO projects (account_id, project_id, project_name, status)
VALUES
  ('test-account', 'project-1', 'Test Project Alpha', 'active'),
  ('test-account', 'project-2', 'Test Project Beta', 'active');

-- Create test job execution
INSERT INTO job_executions (
  id, user_id, status, target_user_emails, target_project_ids,
  assigned_role, total_projects, success_count
)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM users WHERE email = 'test@example.com'),
  'completed',
  ARRAY['user1@test.com'],
  ARRAY['project-1'],
  'project_admin',
  1,
  1
);
```

---

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd backend && npm ci
      - name: Run tests
        run: cd backend && npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run tests
        run: cd frontend && npm test
      - name: Build
        run: cd frontend && npm run build
```

---

## Test Coverage Reports

**Generate Coverage:**
```bash
# Backend
cd backend
npm test -- --coverage
open coverage/lcov-report/index.html

# Frontend (if using Jest)
cd frontend
npm test -- --coverage
```

**CI Coverage Reporting:**
- Use Codecov or Coveralls
- Set minimum coverage thresholds
- Block PRs that decrease coverage

---

## Summary

**Testing Workflow:**
1. Write unit tests for new features
2. Run integration tests locally
3. Run E2E tests before PR
4. Load test before major releases
5. Manual testing checklist before deploy
6. Monitor production after deploy

**Coverage Goals:**
- Unit: 80%+
- Integration: All endpoints
- E2E: Critical flows
- Load: Performance benchmarks

**Best Practices:**
- Test early, test often
- Automate repetitive tests
- Keep tests fast and isolated
- Use realistic test data
- Monitor test results in CI
