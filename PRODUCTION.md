# Production Deployment Guide

Quick guide for deploying ACC User Manager to production.

## Quick Start

### Option 1: Railway (Recommended for Quick Setup)

Railway provides the easiest path to production with managed PostgreSQL and Redis.

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create New Project**
   ```bash
   railway init
   ```

3. **Add PostgreSQL and Redis**
   ```bash
   railway add postgresql
   railway add redis
   ```

4. **Set Environment Variables**
   ```bash
   # Copy and edit production environment variables
   cp .env.production.example .env.production

   # Edit .env.production with your values
   # Then upload to Railway:
   railway variables set -e production < .env.production
   ```

5. **Deploy Backend**
   ```bash
   cd backend
   railway up
   ```

6. **Deploy Worker**
   ```bash
   # Create worker service
   railway service create worker
   railway variables set START_COMMAND="node dist/workers/job-processor.js"
   railway up
   ```

7. **Deploy Frontend on Vercel**
   ```bash
   cd frontend
   npm install -g vercel
   vercel --prod
   ```

### Option 2: Docker Deployment

For deployment on your own infrastructure (AWS, GCP, DigitalOcean, etc.)

1. **Prepare Environment**
   ```bash
   cp .env.production.example .env
   # Edit .env with your production values
   ```

2. **Build and Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Run Migrations**
   ```bash
   docker-compose exec backend npm run migrate
   ```

4. **Verify Deployment**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3000
   ```

### Option 3: Kubernetes

For enterprise deployments requiring high availability.

See `docs/DEPLOYMENT.md` for Kubernetes configuration examples.

## Pre-Deployment Checklist

- [ ] APS App registered with production callback URL
- [ ] PostgreSQL database provisioned
- [ ] Redis instance provisioned
- [ ] Environment variables configured
- [ ] SSL/TLS certificates obtained
- [ ] Domain DNS configured
- [ ] Backup strategy in place
- [ ] Monitoring configured

## Environment Variables

### Required Variables

```bash
# APS OAuth
APS_CLIENT_ID=your_client_id
APS_CLIENT_SECRET=your_client_secret
APS_CALLBACK_URL=https://yourdomain.com/api/auth/callback

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379

# Security (generate with: openssl rand -hex 32)
SESSION_SECRET=<32+ character random string>
ENCRYPTION_KEY=<32 byte hex key>

# CORS
CORS_ORIGIN=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### Optional Variables

```bash
# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# Performance
QUEUE_CONCURRENCY=5
DATABASE_POOL_MAX=20
```

## Platform-Specific Deployment

### Railway

**Backend & Worker:**
- Railway automatically detects the build configuration from `railway.json`
- Supports automatic deployments from GitHub
- Built-in PostgreSQL and Redis addons

**Frontend:**
- Deploy to Vercel for optimal Next.js performance
- Automatic CDN distribution
- Edge functions support

### AWS

**Backend:**
- ECS Fargate with Application Load Balancer
- RDS PostgreSQL with automated backups
- ElastiCache Redis cluster
- CloudWatch for logging

**Frontend:**
- S3 + CloudFront for static hosting
- Lambda@Edge for SSR (if needed)

**Infrastructure as Code:**
```bash
# See docs/DEPLOYMENT.md for Terraform examples
terraform init
terraform plan
terraform apply
```

### Kubernetes

**Deployment:**
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/worker.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

## Database Setup

### Run Migrations

```bash
# Development
cd backend
npm run migrate

# Production (Railway)
railway run npm run migrate

# Production (Docker)
docker-compose exec backend npm run migrate

# Production (Kubernetes)
kubectl exec -it deployment/backend -- npm run migrate
```

### Backup Strategy

**Automated Backups:**
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > "backup_${TIMESTAMP}.sql.gz"
# Upload to S3 or your backup storage
aws s3 cp "backup_${TIMESTAMP}.sql.gz" s3://your-backup-bucket/
EOF

chmod +x backup.sh

# Schedule with cron
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

## Monitoring

### Health Checks

The application provides comprehensive health checks:

```bash
curl https://api.yourdomain.com/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

### Logging

Logs are written to:
- **Console**: JSON format for aggregation
- **Files**: `logs/error.log` and `logs/combined.log` (production)

**View Logs:**
```bash
# Railway
railway logs

# Docker
docker-compose logs -f backend

# Kubernetes
kubectl logs -f deployment/backend
```

### Metrics

Recommended monitoring setup:
- **Uptime**: UptimeRobot or Pingdom
- **APM**: New Relic, DataDog, or Elastic APM
- **Error Tracking**: Sentry
- **Logs**: CloudWatch, LogDNA, or ELK Stack

## Security Considerations

### SSL/TLS

- **Always use HTTPS in production**
- Configure SSL certificates (Let's Encrypt recommended)
- Enable HSTS headers

### Environment Security

- Never commit `.env` files to version control
- Use secret management (AWS Secrets Manager, HashiCorp Vault)
- Rotate credentials regularly
- Use managed database services with encryption at rest

### Network Security

- Configure firewall rules
- Restrict database access to application servers only
- Use VPC/private networks when possible
- Enable DDoS protection

## Performance Optimization

### Database

```sql
-- Add indexes (if not already present)
CREATE INDEX CONCURRENTLY idx_job_executions_user_created
  ON job_executions(user_id, created_at DESC);

-- Regular maintenance
VACUUM ANALYZE;
```

### Caching

- Redis is used for session storage and rate limiting
- Consider adding API response caching for frequently accessed data

### Scaling

**Horizontal Scaling:**
- Backend: Scale to multiple instances behind load balancer
- Worker: Scale based on queue length
- Database: Use read replicas for heavy read workloads

**Vertical Scaling:**
- Start with: 1 CPU, 2GB RAM
- Monitor and adjust based on usage

## Troubleshooting

### Common Issues

**1. Database Connection Failed**
```bash
# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

**2. OAuth Callback Fails**
```bash
# Verify callback URL matches APS app registration
# Check CORS_ORIGIN setting
# Ensure SSL is properly configured
```

**3. Jobs Not Processing**
```bash
# Check worker is running
docker-compose ps worker  # Docker
railway logs worker       # Railway

# Check Redis connection
redis-cli -u $REDIS_URL ping
```

**4. High Memory Usage**
```bash
# Check logs for memory leaks
# Adjust NODE_OPTIONS if needed:
NODE_OPTIONS="--max-old-space-size=2048"
```

## Rollback Procedures

### Railway
```bash
railway rollback
```

### Docker
```bash
# Keep previous image tagged
docker tag acc-user-manager-backend:latest acc-user-manager-backend:previous
# To rollback:
docker-compose down
docker tag acc-user-manager-backend:previous acc-user-manager-backend:latest
docker-compose up -d
```

### Kubernetes
```bash
kubectl rollout undo deployment/backend
kubectl rollout undo deployment/worker
```

## Support

- **Documentation**: See `/docs` folder for detailed guides
- **Issues**: Open GitHub issue
- **Security**: Report vulnerabilities privately

## Production Checklist

Before going live:

- [ ] All environment variables set correctly
- [ ] Database migrations run successfully
- [ ] Health checks passing
- [ ] SSL/TLS configured
- [ ] OAuth flow tested end-to-end
- [ ] Monitoring and alerts configured
- [ ] Backup strategy implemented
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] Documentation updated
- [ ] Team trained on operations

---

**Need help?** See the complete deployment guide in `docs/DEPLOYMENT.md`
