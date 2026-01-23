# Deploy Your ACC User Manager to Railway - Ready to Go!

Everything is set up and ready for deployment. Follow these steps on your local machine.

## Prerequisites Check

- ✅ Railway account (you have this)
- ✅ APS credentials (you have this)
- ✅ Code is ready and committed
- ✅ All production configurations are in place

## Quick Deploy (Choose One Method)

### Method 1: Automated Script (Easiest)

Open your terminal on your local machine and run:

```bash
cd /path/to/acc-user-manager
./scripts/deploy-railway.sh
```

The script will prompt you for:
- APS Client ID
- APS Client Secret

Everything else is automatic!

---

### Method 2: Manual Commands (Full Control)

If you prefer to see each step, follow these commands:

#### Step 1: Install Railway CLI (if not installed)

```bash
npm install -g @railway/cli
```

#### Step 2: Login to Railway

```bash
railway login
```

This will open your browser for authentication.

#### Step 3: Navigate to Backend

```bash
cd backend
```

#### Step 4: Initialize Railway Project

```bash
railway init
```

Choose:
- Option: "Create a new project"
- Name: "acc-user-manager" (or your preferred name)

#### Step 5: Add Database Services

```bash
# Add PostgreSQL
railway add

# Select: PostgreSQL
# Confirm

# Add Redis
railway add

# Select: Redis
# Confirm
```

#### Step 6: Generate Secrets

Run these commands to generate secure secrets:

```bash
# Generate SESSION_SECRET
openssl rand -hex 32

# Generate ENCRYPTION_KEY
openssl rand -hex 32
```

**Save these values!** You'll need them in the next step.

#### Step 7: Set Environment Variables

Replace the placeholder values with your actual credentials:

```bash
# Core configuration
railway variables set NODE_ENV=production

# APS Credentials (replace with your values)
railway variables set APS_CLIENT_ID=YOUR_APS_CLIENT_ID_HERE
railway variables set APS_CLIENT_SECRET=YOUR_APS_CLIENT_SECRET_HERE

# Generated secrets (paste the values from Step 6)
railway variables set SESSION_SECRET=YOUR_GENERATED_SESSION_SECRET
railway variables set ENCRYPTION_KEY=YOUR_GENERATED_ENCRYPTION_KEY

# Logging and rate limiting
railway variables set LOG_LEVEL=info
railway variables set RATE_LIMIT_WINDOW_MS=900000
railway variables set RATE_LIMIT_MAX_REQUESTS=100
```

#### Step 8: Deploy Backend

```bash
railway up
```

Wait for deployment to complete. You'll see output like:
```
✓ Build successful
✓ Deployment live
🎉 Deployment successful
```

Railway will provide you with a URL like:
`https://acc-user-manager-production-xxxxx.up.railway.app`

**Save this URL!** You'll need it for the frontend.

#### Step 9: Run Database Migrations

```bash
railway run npm run migrate
```

You should see:
```
Migration 001_initial_schema.sql completed
✓ All migrations completed successfully
```

#### Step 10: Create Worker Service

```bash
# Create new service
railway service create worker

# Set worker environment variables (use same credentials as backend)
railway variables set --service worker NODE_ENV=production
railway variables set --service worker APS_CLIENT_ID=YOUR_APS_CLIENT_ID
railway variables set --service worker APS_CLIENT_SECRET=YOUR_APS_CLIENT_SECRET
railway variables set --service worker SESSION_SECRET=SAME_AS_BACKEND
railway variables set --service worker ENCRYPTION_KEY=SAME_AS_BACKEND
railway variables set --service worker QUEUE_CONCURRENCY=3

# Deploy worker
railway up --service worker
```

#### Step 11: Test Backend Deployment

```bash
# Test health endpoint (replace with your Railway URL)
curl https://your-backend-url.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-23T...",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

✅ **Backend and Worker are now live!**

---

## Deploy Frontend to Vercel

#### Step 1: Navigate to Frontend

```bash
cd ../frontend
```

#### Step 2: Install Vercel CLI (if not installed)

```bash
npm install -g vercel
```

#### Step 3: Login to Vercel

```bash
vercel login
```

#### Step 4: Deploy to Production

```bash
vercel --prod
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- What's your project's name? **acc-user-manager** (or preferred)
- In which directory is your code located? **./** (press Enter)
- Want to modify settings? **N**

Wait for deployment. You'll get a URL like:
`https://acc-user-manager.vercel.app`

#### Step 5: Set Frontend Environment Variable

```bash
vercel env add NEXT_PUBLIC_API_URL production
```

When prompted, enter your Railway backend URL:
```
https://your-backend-url.up.railway.app
```

#### Step 6: Redeploy Frontend

```bash
vercel --prod
```

---

## Final Configuration

### Step 1: Update APS App Callback URL

1. Go to https://aps.autodesk.com/
2. Select your application
3. Click "Edit"
4. Update **Callback URL** to:
   ```
   https://your-frontend-url.vercel.app/api/auth/callback
   ```
5. Save

### Step 2: Update Backend Environment Variables

Back in your terminal (in the backend folder):

```bash
# Update with your actual Vercel frontend URL
railway variables set APS_CALLBACK_URL=https://your-frontend-url.vercel.app/api/auth/callback
railway variables set CORS_ORIGIN=https://your-frontend-url.vercel.app
railway variables set FRONTEND_URL=https://your-frontend-url.vercel.app
```

### Step 3: Final Test

1. Open your frontend URL in browser: `https://your-frontend-url.vercel.app`
2. Click "Sign in with Autodesk"
3. Authenticate with your Autodesk account
4. You should see the dashboard!

---

## 🎉 Deployment Complete!

Your ACC User Manager is now live in production!

### Your Production URLs

- **Frontend**: https://your-frontend-url.vercel.app
- **Backend**: https://your-backend-url.up.railway.app
- **Health Check**: https://your-backend-url.up.railway.app/health

### Save These for Reference

Store these securely (password manager recommended):
- APS Client ID
- APS Client Secret
- SESSION_SECRET
- ENCRYPTION_KEY
- Railway Backend URL
- Vercel Frontend URL

---

## Troubleshooting

### View Logs

```bash
# Backend logs
cd backend
railway logs

# Worker logs
railway logs --service worker

# Frontend logs
cd frontend
vercel logs
```

### Redeploy

```bash
# Backend
cd backend
railway up

# Worker
railway up --service worker

# Frontend
cd frontend
vercel --prod
```

### Check Environment Variables

```bash
# Railway
railway variables

# Vercel
vercel env ls
```

### Common Issues

**1. OAuth Callback Error**
- Verify callback URL in APS matches exactly: `https://your-frontend.vercel.app/api/auth/callback`
- Check `APS_CALLBACK_URL` in Railway backend variables
- Ensure no trailing slashes

**2. CORS Error**
- Verify `CORS_ORIGIN` matches your frontend URL exactly
- Check browser console for specific CORS error

**3. Database Connection Error**
- Check Railway logs: `railway logs`
- Verify PostgreSQL plugin is added: `railway plugins`
- Ensure migrations ran: `railway run npm run migrate`

**4. Jobs Not Processing**
- Check worker logs: `railway logs --service worker`
- Verify Redis plugin is added
- Ensure worker environment variables match backend

---

## Next Steps

1. **Set Up Monitoring**
   - UptimeRobot for uptime monitoring
   - Sentry for error tracking

2. **Custom Domain (Optional)**
   ```bash
   # Railway
   railway domain

   # Vercel
   vercel domains add yourdomain.com
   ```

3. **Enable Backups**
   - Railway has automatic PostgreSQL backups
   - Configure backup retention in Railway dashboard

4. **Team Access**
   - Add team members in Railway dashboard
   - Add collaborators in Vercel dashboard

---

## Support

If you encounter issues:

1. **Check Logs First**
   - Railway: `railway logs`
   - Vercel: `vercel logs`

2. **Health Check**
   - Visit: `https://your-backend.up.railway.app/health`
   - Should show all services as "healthy"

3. **Documentation**
   - Railway: https://docs.railway.app/
   - Vercel: https://vercel.com/docs

---

**Ready to deploy? Start with Method 1 (automated script) or Method 2 (manual commands)!**

Good luck! 🚀
