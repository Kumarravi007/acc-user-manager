# ACC Multi-Project User Manager

Production-ready web application for managing users across multiple Autodesk Construction Cloud (ACC) projects simultaneously.

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 15+
- **Cache/Queue**: Redis 7+
- **Job Queue**: BullMQ

### System Components

```
Frontend (Next.js) → Backend API (Express) → APS/ACC APIs
                           ↓
                    PostgreSQL + Redis
                           ↓
                    BullMQ Job Queue
```

## Features

### MVP (Phase 1)
- ✅ Autodesk OAuth 2.0 (3-legged) authentication
- ✅ List all ACC projects under account
- ✅ Multi-select projects
- ✅ Add single/multiple users by email
- ✅ Assign project roles (Admin, Member, Docs Admin)
- ✅ Preview existing access before execution
- ✅ Async bulk operation with job queue
- ✅ Real-time status tracking
- ✅ Audit logging

### Future Enhancements (Phase 2+)
- Role templates
- CSV bulk upload
- Power BI integration
- Azure AD sync
- Scheduled user provisioning
- Advanced reporting

## Project Structure

```
acc-user-manager/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration management
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Business logic
│   │   │   ├── aps/         # APS API integration
│   │   │   ├── queue/       # Job queue management
│   │   │   └── auth/        # Authentication
│   │   ├── repositories/    # Data access layer
│   │   ├── models/          # Database models
│   │   ├── middleware/      # Express middleware
│   │   ├── utils/           # Utilities
│   │   ├── types/           # TypeScript definitions
│   │   └── app.ts           # Application entry
│   ├── migrations/          # Database migrations
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js app router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # Client utilities
│   │   ├── hooks/           # Custom React hooks
│   │   └── types/           # TypeScript definitions
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DEPLOYMENT.md
└── docker-compose.yml
```

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Autodesk Platform Services (APS) App Credentials

## Setup Instructions

### 1. APS App Registration

1. Go to [APS Developer Portal](https://aps.autodesk.com/)
2. Create new app with:
   - **App Type**: Web App
   - **Callback URL**: `http://localhost:3000/api/auth/callback`
   - **APIs**: BIM 360 API, Data Management API
3. Note down `Client ID` and `Client Secret`

### 2. Environment Configuration

```bash
# Backend (.env)
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
NODE_ENV=development
PORT=3001

# APS OAuth
APS_CLIENT_ID=your_client_id
APS_CLIENT_SECRET=your_client_secret
APS_CALLBACK_URL=http://localhost:3000/api/auth/callback

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/acc_user_manager

# Redis
REDIS_URL=redis://localhost:6379

# Session
SESSION_SECRET=your_random_secret_here

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

```bash
# Frontend (.env.local)
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Database Setup

```bash
# Using Docker
docker-compose up -d postgres redis

# Run migrations
cd backend
npm run migrate
```

### 4. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Run Development Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Worker (Job Queue)
cd backend
npm run worker
```

Access the application at `http://localhost:3000`

## API Documentation

See [docs/API.md](docs/API.md) for detailed API documentation.

## Database Schema

See migrations in `backend/migrations/` for complete schema.

### Key Tables:
- `users` - Application users (mapped to APS users)
- `projects` - Cached ACC project data
- `job_executions` - Bulk operation job tracking
- `job_results` - Per-project operation results
- `audit_logs` - Complete audit trail

## Security Considerations

- OAuth tokens stored encrypted in session
- Rate limiting on all API endpoints
- CSRF protection
- SQL injection prevention (parameterized queries)
- XSS protection (React + Content Security Policy)
- Role-based access control (Account Admin only)

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production deployment guide.

Recommended platforms:
- **Frontend**: Vercel, Netlify
- **Backend**: Railway, Render, AWS ECS
- **Database**: AWS RDS, Railway
- **Redis**: AWS ElastiCache, Upstash

## License

MIT

## Support

For issues and feature requests, please open a GitHub issue.
