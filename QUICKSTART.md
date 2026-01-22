# Quick Start Guide

Get the ACC Multi-Project User Manager running locally in under 10 minutes.

## Prerequisites

Ensure you have the following installed:
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Git** ([Download](https://git-scm.com/))

## Step 1: Register APS Application (5 minutes)

1. Go to [Autodesk Platform Services](https://aps.autodesk.com/)
2. Sign in with your Autodesk account
3. Click **"Create Application"**
4. Fill in details:
   - **App Name**: ACC User Manager (Dev)
   - **App Type**: Web App
   - **Callback URL**: `http://localhost:3000/api/auth/callback`
   - **APIs**: Enable **BIM 360 API** and **Data Management API**
5. Click **Create**
6. **Save** your `Client ID` and `Client Secret`

## Step 2: Clone & Setup (2 minutes)

```bash
# Clone the repository
cd D:\CCTech_Consultant\AI Project\acc-user-manager

# Start PostgreSQL and Redis with Docker
docker-compose up -d

# Wait for services to be ready (check with docker ps)
```

## Step 3: Backend Setup (2 minutes)

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create environment file
copy .env.example .env

# Edit .env with your editor and add:
# - APS_CLIENT_ID=<your-client-id>
# - APS_CLIENT_SECRET=<your-client-secret>
# - SESSION_SECRET=<generate-random-32-char-string>
# - ENCRYPTION_KEY=<generate-random-32-char-hex>

# Generate random secrets (PowerShell):
# SESSION_SECRET: -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
# ENCRYPTION_KEY: -join ((0..31) | ForEach-Object {'{0:x2}' -f (Get-Random -Maximum 256)})

# Run database migrations
npm run migrate

# Start backend server
npm run dev
```

Backend will run on `http://localhost:3001`

## Step 4: Start Worker (1 minute)

Open a **new terminal**:

```bash
cd D:\CCTech_Consultant\AI Project\acc-user-manager\backend

# Start the job worker
npm run worker
```

## Step 5: Frontend Setup (2 minutes)

Open **another new terminal**:

```bash
cd D:\CCTech_Consultant\AI Project\acc-user-manager\frontend

# Install dependencies
npm install

# Create environment file
copy .env.example .env.local

# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:3001

# Start frontend server
npm run dev
```

Frontend will run on `http://localhost:3000`

## Step 6: Test It Out! (1 minute)

1. Open browser to `http://localhost:3000`
2. Click **"Login with Autodesk"**
3. Authenticate with your ACC account
4. You should see the dashboard!

## Verify Everything Works

### Check Backend Health
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Check Database Connection
```bash
docker exec -it acc-user-manager-postgres psql -U postgres -d acc_user_manager -c "SELECT COUNT(*) FROM users;"
# Should return a count (0 if no users yet)
```

### Check Redis Connection
```bash
docker exec -it acc-user-manager-redis redis-cli PING
# Should return: PONG
```

## Troubleshooting

### Port Already in Use

**Backend (3001) or Frontend (3000)**:
```bash
# Windows: Find and kill process
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Or change port in .env (backend) or package.json (frontend)
```

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker ps

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker logs acc-user-manager-postgres
```

### Redis Connection Error

```bash
# Check if Redis is running
docker ps

# Restart Redis
docker-compose restart redis

# Check logs
docker logs acc-user-manager-redis
```

### Migration Errors

```bash
# Drop and recreate database
docker exec -it acc-user-manager-postgres psql -U postgres -c "DROP DATABASE acc_user_manager;"
docker exec -it acc-user-manager-postgres psql -U postgres -c "CREATE DATABASE acc_user_manager;"

# Run migrations again
cd backend
npm run migrate
```

### OAuth Callback Error

1. Verify callback URL in APS app: `http://localhost:3000/api/auth/callback`
2. Check `APS_CLIENT_ID` and `APS_CLIENT_SECRET` in `.env`
3. Ensure `APS_CALLBACK_URL=http://localhost:3000/api/auth/callback` in `.env`

## Next Steps

### Add Your First Users to Projects

1. **Login** to the app
2. **Select Projects** - Choose multiple projects from your ACC account
3. **Enter User Emails** - Add one or more email addresses
4. **Select Role** - Choose a project role (Admin, Member, etc.)
5. **Preview** - Review what will happen
6. **Execute** - Start the bulk operation
7. **Monitor** - Watch real-time progress

### Explore the Code

**Key Files to Understand:**

**Backend:**
- `backend/src/services/aps/auth.service.ts` - OAuth authentication
- `backend/src/services/aps/projects.service.ts` - APS API integration
- `backend/src/controllers/bulk-operations.controller.ts` - Bulk operations
- `backend/src/workers/job-processor.ts` - Background job processing

**Database:**
- `backend/migrations/001_initial_schema.sql` - Database schema

**Documentation:**
- `README.md` - Project overview
- `docs/ARCHITECTURE.md` - System architecture
- `docs/API.md` - API documentation
- `IMPLEMENTATION_GUIDE.md` - Detailed implementation guide

### Development Tips

**Hot Reload:**
- Backend uses `tsx watch` - changes auto-reload
- Frontend uses Next.js dev server - changes auto-reload
- Worker uses `tsx watch` - changes auto-reload

**View Logs:**
```bash
# Backend logs
# Check terminal running npm run dev

# Database logs
docker logs acc-user-manager-postgres

# Redis logs
docker logs acc-user-manager-redis

# Worker logs
# Check terminal running npm run worker
```

**Database GUI:**
```bash
# Install pgAdmin or use VS Code extension "PostgreSQL"
# Connection:
# Host: localhost
# Port: 5432
# Database: acc_user_manager
# User: postgres
# Password: postgres
```

**Redis GUI:**
```bash
# Install RedisInsight
# Connection: redis://localhost:6379
```

## Common Development Tasks

### Reset Database
```bash
cd backend
npm run migrate:down  # Rollback
npm run migrate       # Apply again
```

### Create New Migration
```bash
cd backend
npm run migrate:create migration-name
# Edit the generated file in migrations/
npm run migrate  # Apply it
```

### View Job Queue
```bash
# In Node.js REPL or create a script:
const { Redis } = require('ioredis');
const redis = new Redis('redis://localhost:6379');

redis.keys('bull:bulk-user-assignment:*', (err, keys) => {
  console.log('Queue keys:', keys);
});
```

### Test API Endpoints
```bash
# Using curl or Postman

# Health check
curl http://localhost:3001/health

# Get projects (requires authentication)
curl http://localhost:3001/api/projects \
  -H "Cookie: connect.sid=<session-cookie>"
```

## Stopping the Application

```bash
# Stop backend: Ctrl+C in backend terminal
# Stop worker: Ctrl+C in worker terminal
# Stop frontend: Ctrl+C in frontend terminal

# Stop Docker services
docker-compose down

# To remove data volumes too:
docker-compose down -v
```

## Production Deployment

See `IMPLEMENTATION_GUIDE.md` for detailed production deployment instructions.

## Getting Help

1. **Check Documentation**: Review `docs/` folder
2. **Check Logs**: Look at terminal outputs and Docker logs
3. **GitHub Issues**: Open an issue with:
   - Error message
   - Steps to reproduce
   - Environment (OS, Node version, etc.)

## What's Next?

Once you have the backend running:

1. **Complete Frontend UI** (if not already done)
2. **Add Tests** - Unit and integration tests
3. **Customize** - Adapt to your specific needs
4. **Deploy** - Move to production

---

**Happy Coding! 🚀**

If you found this helpful, please star the repository!
