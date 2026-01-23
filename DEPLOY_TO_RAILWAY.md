# Deploy to Railway - Step by Step Guide

Follow these steps to deploy your ACC User Manager to Railway.

## Prerequisites

- ✅ Railway account (you have this)
- ✅ APS credentials (you have this)
- ✅ Railway CLI installed

## Quick Deploy (Automated)

Run the automated deployment script:

```bash
./scripts/deploy-railway.sh
```

This will:
1. Install Railway CLI (if needed)
2. Login to Railway
3. Create/link project
4. Add PostgreSQL and Redis
5. Set environment variables (will prompt you)
6. Deploy backend and worker
7. Run database migrations

## Manual Deploy (Step by Step)

If you prefer to do it manually, follow these steps:

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

### Step 2: Login to Railway

```bash
railway login
```

### Step 3: Create New Project

```bash
# Navigate to backend folder
cd backend

# Initialize Railway project
railway init

# Name it: acc-user-manager
```

### Step 4: Add Database Services

```bash
# Add PostgreSQL
railway add --plugin postgresql

# Add Redis
railway add --plugin redis
```

### Step 5: Generate Secrets

```bash
# Generate SESSION_SECRET
openssl rand -hex 32

# Generate ENCRYPTION_KEY
openssl rand -hex 32

# Save these values - you'll need them!
```

### Step 6: Set Backend Environment Variables

Replace `<YOUR_VALUE>` with your actual values:

```bash
railway variables set NODE_ENV=production
railway variables set APS_CLIENT_ID=<YOUR_APS_CLIENT_ID>
railway variables set APS_CLIENT_SECRET=<YOUR_APS_CLIENT_SECRET>
railway variables set SESSION_SECRET=<GENERATED_SESSION_SECRET>
railway variables set ENCRYPTION_KEY=<GENERATED_ENCRYPTION_KEY>
railway variables set LOG_LEVEL=info
```

### Step 7: Deploy Backend

```bash
# Make sure you're in the backend folder
railway up
```

Wait for deployment to complete. Railway will give you a URL like:
`https://acc-user-manager-production.up.railway.app`

### Step 8: Run Database Migrations

```bash
railway run npm run migrate
```

### Step 9: Create and Deploy Worker

```bash
# Create worker service
railway service create worker

# Set worker environment variables
railway variables set --service worker NODE_ENV=production
railway variables set --service worker APS_CLIENT_ID=<YOUR_APS_CLIENT_ID>
railway variables set --service worker APS_CLIENT_SECRET=<YOUR_APS_CLIENT_SECRET>
railway variables set --service worker SESSION_SECRET=<SAME_AS_BACKEND>
railway variables set --service worker ENCRYPTION_KEY=<SAME_AS_BACKEND>
railway variables set --service worker QUEUE_CONCURRENCY=3

# Deploy worker
railway up --service worker
```

### Step 10: Deploy Frontend to Vercel

```bash
# Navigate to frontend folder
cd ../frontend

# Install Vercel CLI (if not installed)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Set environment variable
vercel env add NEXT_PUBLIC_API_URL production
# Enter your Railway backend URL: https://your-backend.up.railway.app
```

### Step 11: Update Callback URLs

1. **Update APS App:**
   - Go to https://aps.autodesk.com/
   - Edit your application
   - Set callback URL to: `https://your-vercel-app.vercel.app/api/auth/callback`

2. **Update Railway Backend Variables:**

```bash
cd backend

railway variables set APS_CALLBACK_URL=https://your-vercel-app.vercel.app/api/auth/callback
railway variables set CORS_ORIGIN=https://your-vercel-app.vercel.app
railway variables set FRONTEND_URL=https://your-vercel-app.vercel.app
```

### Step 12: Test Deployment

```bash
# Test backend health
curl https://your-backend.up.railway.app/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2024-01-23T...",
#   "services": {
#     "database": "healthy",
#     "redis": "healthy"
#   }
# }
```

Visit your frontend URL and test the login flow!

## Troubleshooting

### View Logs

```bash
# Backend logs
railway logs

# Worker logs
railway logs --service worker
```

### Check Environment Variables

```bash
railway variables
```

### Redeploy

```bash
# Backend
cd backend
railway up

# Worker
railway up --service worker
```

### Database Issues

```bash
# Check database connection
railway run psql -c "SELECT 1"

# Re-run migrations
railway run npm run migrate
```

### Worker Not Processing Jobs

1. Check worker logs: `railway logs --service worker`
2. Verify Redis connection in logs
3. Ensure environment variables match backend

## Custom Domain (Optional)

### Add Custom Domain to Railway

```bash
railway domain
```

Follow prompts to add your custom domain.

### Update DNS

Add CNAME record:
```
Type: CNAME
Name: api (or your subdomain)
Value: <railway-domain>.up.railway.app
```

### Update Environment Variables

```bash
railway variables set APS_CALLBACK_URL=https://yourdomain.com/api/auth/callback
railway variables set CORS_ORIGIN=https://yourdomain.com
railway variables set FRONTEND_URL=https://yourdomain.com
```

Update APS app callback URL accordingly.

## Monitoring

### Set Up Alerts

In Railway dashboard:
1. Go to your project
2. Click "Settings"
3. Configure health check alerts
4. Add your email for notifications

### Health Check Endpoint

Railway automatically monitors: `https://your-backend.up.railway.app/health`

## Cost Optimization

Railway pricing:
- Free tier: $5/month in credits
- Pro: $20/month

**Tips to stay within free tier:**
1. Use Hobby PostgreSQL (included)
2. Use Hobby Redis (included)
3. Monitor resource usage
4. Set up usage alerts

## Security Checklist

After deployment:

- [ ] APS credentials stored as environment variables (not in code)
- [ ] SESSION_SECRET is unique and random
- [ ] ENCRYPTION_KEY is unique and random
- [ ] HTTPS is enabled (automatic on Railway/Vercel)
- [ ] CORS_ORIGIN is set to frontend URL
- [ ] Callback URL matches APS app configuration
- [ ] Database backups enabled (Railway automatic backups)

## Next Steps

1. **Test the application thoroughly**
2. **Set up monitoring** (UptimeRobot, Sentry)
3. **Configure custom domain** (optional)
4. **Document your production URLs**
5. **Share with your team**

## Getting Help

- Railway Docs: https://docs.railway.app/
- Railway Discord: https://discord.gg/railway
- Project Issues: GitHub issues

---

**You're now live in production! 🎉**
