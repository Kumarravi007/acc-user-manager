# Deployment Guide

Complete guide for deploying ACC Multi-Project User Manager to production.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Worker Deployment](#worker-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Post-Deployment](#post-deployment)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment Checklist

- [ ] APS App registered with production callback URL
- [ ] PostgreSQL database provisioned
- [ ] Redis instance provisioned
- [ ] SSL certificates obtained
- [ ] Domain configured
- [ ] Environment variables prepared
- [ ] Backup strategy in place
- [ ] Monitoring tools configured
- [ ] Error tracking set up

---

## Environment Setup

### 1. Register Production APS Application

1. Go to [APS Developer Portal](https://aps.autodesk.com/)
2. Create new application:
   - **Name**: ACC User Manager (Production)
   - **Type**: Web App
   - **Callback URL**: `https://yourdomain.com/api/auth/callback`
   - **APIs**: BIM 360 API, Data Management API
3. Save Client ID and Client Secret

### 2. Generate Secrets

```bash
# SESSION_SECRET (32+ characters)
openssl rand -hex 32

# ENCRYPTION_KEY (32 bytes hex)
openssl rand -hex 32
```

---

## Database Setup

### Option 1: AWS RDS PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier acc-user-manager-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username admin \
  --master-user-password <strong-password> \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name default \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00"

# Enable automated backups
aws rds modify-db-instance \
  --db-instance-identifier acc-user-manager-prod \
  --backup-retention-period 30 \
  --apply-immediately
```

**Connection String:**
```
DATABASE_URL=postgresql://admin:password@acc-user-manager-prod.xxxxx.us-east-1.rds.amazonaws.com:5432/acc_user_manager
```

### Option 2: Railway

1. Create new PostgreSQL database
2. Copy connection string from Railway dashboard
3. Note: Railway handles backups automatically

### Run Migrations

```bash
cd backend
npm install
DATABASE_URL=<your-connection-string> npm run migrate
```

---

## Backend Deployment

### Option 1: Railway

1. **Create New Project**
   ```bash
   railway login
   railway init
   ```

2. **Deploy Backend**
   ```bash
   cd backend
   railway up
   ```

3. **Configure Environment Variables**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set PORT=3001
   railway variables set APS_CLIENT_ID=<your-client-id>
   railway variables set APS_CLIENT_SECRET=<your-client-secret>
   railway variables set APS_CALLBACK_URL=https://yourdomain.com/api/auth/callback
   railway variables set DATABASE_URL=<your-database-url>
   railway variables set REDIS_URL=<your-redis-url>
   railway variables set SESSION_SECRET=<generated-secret>
   railway variables set ENCRYPTION_KEY=<generated-key>
   railway variables set CORS_ORIGIN=https://yourdomain.com
   ```

4. **Set Start Command**
   - In Railway dashboard: Settings → Start Command
   - Command: `npm run build && npm start`

### Option 2: AWS ECS (Fargate)

1. **Build Docker Image**
   ```dockerfile
   # backend/Dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   EXPOSE 3001
   CMD ["node", "dist/app.js"]
   ```

2. **Push to ECR**
   ```bash
   aws ecr create-repository --repository-name acc-user-manager-backend
   docker build -t acc-user-manager-backend .
   docker tag acc-user-manager-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/acc-user-manager-backend:latest
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/acc-user-manager-backend:latest
   ```

3. **Create ECS Task Definition**
   ```json
   {
     "family": "acc-user-manager-backend",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "512",
     "memory": "1024",
     "containerDefinitions": [
       {
         "name": "backend",
         "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/acc-user-manager-backend:latest",
         "portMappings": [
           {
             "containerPort": 3001,
             "protocol": "tcp"
           }
         ],
         "environment": [
           { "name": "NODE_ENV", "value": "production" },
           { "name": "PORT", "value": "3001" }
         ],
         "secrets": [
           {
             "name": "APS_CLIENT_ID",
             "valueFrom": "arn:aws:secretsmanager:us-east-1:xxxxx:secret:aps-client-id"
           }
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/acc-user-manager",
             "awslogs-region": "us-east-1",
             "awslogs-stream-prefix": "backend"
           }
         }
       }
     ]
   }
   ```

4. **Create Service**
   ```bash
   aws ecs create-service \
     --cluster acc-user-manager \
     --service-name backend \
     --task-definition acc-user-manager-backend:1 \
     --desired-count 2 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}" \
     --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=backend,containerPort=3001"
   ```

---

## Worker Deployment

### Railway

1. **Create Worker Service**
   ```bash
   cd backend
   railway service create worker
   ```

2. **Set Environment Variables** (same as backend)

3. **Set Start Command**
   - Command: `npm run build && node dist/workers/job-processor.js`

4. **Scale Workers**
   - Can run multiple worker instances for parallel processing

### AWS ECS

1. Create separate task definition for worker
2. Use same Docker image
3. Override command: `["node", "dist/workers/job-processor.js"]`
4. Deploy as separate service (no load balancer needed)

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Connect Repository**
   ```bash
   cd frontend
   vercel
   ```

2. **Configure Environment**
   ```bash
   vercel env add NEXT_PUBLIC_API_URL production
   # Value: https://api.yourdomain.com
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

4. **Configure Custom Domain**
   - In Vercel dashboard: Settings → Domains
   - Add: `yourdomain.com`

### Option 2: Netlify

1. **Build Settings**
   - Build command: `npm run build`
   - Publish directory: `.next`

2. **Environment Variables**
   ```
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   ```

3. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### Option 3: AWS S3 + CloudFront

1. **Build Static Site**
   ```bash
   npm run build
   ```

2. **Upload to S3**
   ```bash
   aws s3 sync out/ s3://acc-user-manager-frontend --delete
   ```

3. **Configure CloudFront**
   - Origin: S3 bucket
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Custom SSL Certificate
   - Default Root Object: index.html

---

## Post-Deployment

### 1. Verify Deployment

**Backend Health Check:**
```bash
curl https://api.yourdomain.com/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Frontend:**
```bash
curl https://yourdomain.com
# Should return HTML
```

**Test OAuth Flow:**
1. Visit `https://yourdomain.com`
2. Click "Sign in with Autodesk"
3. Complete authentication
4. Verify redirect to dashboard

### 2. Database Verification

```sql
-- Connect to production database
\c acc_user_manager

-- Verify tables
\dt

-- Check migrations
SELECT * FROM pgmigrations;
```

### 3. Monitor Initial Traffic

- Check application logs
- Monitor error rates
- Verify job queue processing
- Check database connections

---

## Monitoring & Maintenance

### Application Monitoring

**CloudWatch (AWS):**
```bash
# Create log group
aws logs create-log-group --log-group-name /app/acc-user-manager

# Set retention
aws logs put-retention-policy \
  --log-group-name /app/acc-user-manager \
  --retention-in-days 30
```

**Metrics to Track:**
- API response times
- Error rates
- Job queue length
- Database connections
- Memory/CPU usage

### Error Tracking

**Sentry Setup:**
```bash
npm install @sentry/node @sentry/nextjs
```

```typescript
// backend/src/app.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Uptime Monitoring

**UptimeRobot:**
- Monitor: `https://api.yourdomain.com/health`
- Interval: 5 minutes
- Alert: Email/SMS on failure

### Database Backups

**Automated Backups:**
```bash
# Daily backup script
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz

# Upload to S3
aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://acc-user-manager-backups/
```

**Backup Retention:**
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 12 months

---

## Rollback Procedures

### Backend Rollback

**Railway:**
```bash
railway rollback
```

**AWS ECS:**
```bash
# Update service to previous task definition
aws ecs update-service \
  --cluster acc-user-manager \
  --service backend \
  --task-definition acc-user-manager-backend:PREVIOUS_VERSION
```

### Frontend Rollback

**Vercel:**
```bash
vercel rollback
```

**Netlify:**
- Dashboard → Deploys → Previous Deploy → Publish

### Database Rollback

```bash
cd backend

# Rollback last migration
npm run migrate:down

# Restore from backup
gunzip -c backup-YYYYMMDD.sql.gz | psql $DATABASE_URL
```

---

## Security Checklist

- [ ] All secrets stored in environment variables (not in code)
- [ ] HTTPS enabled on all endpoints
- [ ] CORS restricted to production domain
- [ ] Rate limiting enabled
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS protection (CSP headers)
- [ ] Session cookies are HTTP-only and secure
- [ ] Database credentials rotated
- [ ] Regular dependency updates
- [ ] Security headers (Helmet.js)

---

## Performance Optimization

### Database

```sql
-- Add indexes if needed
CREATE INDEX idx_job_executions_user_created ON job_executions(user_id, created_at DESC);
CREATE INDEX idx_job_results_execution_status ON job_results(execution_id, status);

-- Vacuum regularly
VACUUM ANALYZE;
```

### Caching

```typescript
// Add Redis caching for projects
const cachedProjects = await redis.get(`projects:${accountId}`);
if (cachedProjects) {
  return JSON.parse(cachedProjects);
}

const projects = await apsProjectsService.getProjects(accessToken, accountId);
await redis.setex(`projects:${accountId}`, 3600, JSON.stringify(projects));
```

### CDN

- Use CloudFront/Vercel Edge for static assets
- Enable compression (gzip/brotli)
- Optimize images

---

## Troubleshooting

### Common Issues

**Issue: "Database connection failed"**
- Check DATABASE_URL environment variable
- Verify database is running
- Check security groups/firewall

**Issue: "OAuth callback fails"**
- Verify APS_CALLBACK_URL matches registered callback
- Check CORS_ORIGIN setting
- Verify SSL certificate

**Issue: "Jobs stuck in pending"**
- Check worker process is running
- Verify Redis connection
- Check worker logs

**Issue: "High memory usage"**
- Check for memory leaks
- Review connection pool settings
- Monitor job queue size

---

## Support

For deployment issues:
1. Check application logs
2. Review error tracking (Sentry)
3. Open GitHub issue with details

---

**Deployment Checklist Summary:**

✅ APS app configured
✅ Database provisioned & migrated
✅ Redis provisioned
✅ Backend deployed
✅ Worker deployed
✅ Frontend deployed
✅ Environment variables set
✅ SSL certificates configured
✅ Monitoring enabled
✅ Backups configured
✅ Health checks passing
✅ OAuth flow tested
✅ Documentation updated

**You're ready for production! 🚀**
