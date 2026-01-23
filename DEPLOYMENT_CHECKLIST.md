# Railway Deployment Checklist

Use this checklist to track your deployment progress.

## Pre-Deployment

- [ ] Railway account created and verified
- [ ] APS application registered at https://aps.autodesk.com/
- [ ] APS Client ID and Secret saved securely
- [ ] Railway CLI installed: `npm install -g @railway/cli`
- [ ] Vercel CLI installed: `npm install -g vercel`

## Generate Secrets

Run this command in your terminal:

```bash
chmod +x scripts/generate-secrets.sh
./scripts/generate-secrets.sh
```

- [ ] SESSION_SECRET generated and saved
- [ ] ENCRYPTION_KEY generated and saved

## Railway Backend Deployment

```bash
cd backend
railway login
railway init  # Create new project "acc-user-manager"
```

- [ ] Railway project created
- [ ] Logged into Railway

### Add Services

```bash
railway add  # Select PostgreSQL
railway add  # Select Redis
```

- [ ] PostgreSQL added
- [ ] Redis added

### Set Environment Variables

```bash
railway variables set NODE_ENV=production
railway variables set APS_CLIENT_ID=<your_client_id>
railway variables set APS_CLIENT_SECRET=<your_client_secret>
railway variables set SESSION_SECRET=<generated_secret>
railway variables set ENCRYPTION_KEY=<generated_key>
railway variables set LOG_LEVEL=info
```

- [ ] All environment variables set

### Deploy Backend

```bash
railway up
```

- [ ] Backend deployed successfully
- [ ] Railway URL received and saved: `_______________________`

### Run Migrations

```bash
railway run npm run migrate
```

- [ ] Database migrations completed

### Test Backend

```bash
curl https://your-backend-url.up.railway.app/health
```

- [ ] Health check returns healthy status

## Railway Worker Deployment

```bash
railway service create worker
railway variables set --service worker NODE_ENV=production
railway variables set --service worker APS_CLIENT_ID=<same_as_backend>
railway variables set --service worker APS_CLIENT_SECRET=<same_as_backend>
railway variables set --service worker SESSION_SECRET=<same_as_backend>
railway variables set --service worker ENCRYPTION_KEY=<same_as_backend>
railway variables set --service worker QUEUE_CONCURRENCY=3
railway up --service worker
```

- [ ] Worker service created
- [ ] Worker environment variables set
- [ ] Worker deployed successfully

## Vercel Frontend Deployment

```bash
cd ../frontend
vercel login
vercel --prod
```

- [ ] Vercel project created
- [ ] Frontend deployed
- [ ] Vercel URL received and saved: `_______________________`

### Set Frontend Environment

```bash
vercel env add NEXT_PUBLIC_API_URL production
# Enter your Railway backend URL when prompted
vercel --prod  # Redeploy with new env variable
```

- [ ] NEXT_PUBLIC_API_URL set to Railway backend URL
- [ ] Frontend redeployed

## Final Configuration

### Update APS Callback URL

Go to https://aps.autodesk.com/ and update:

- [ ] Callback URL set to: `https://your-frontend.vercel.app/api/auth/callback`

### Update Backend Environment

```bash
cd backend
railway variables set APS_CALLBACK_URL=https://your-frontend.vercel.app/api/auth/callback
railway variables set CORS_ORIGIN=https://your-frontend.vercel.app
railway variables set FRONTEND_URL=https://your-frontend.vercel.app
```

- [ ] APS_CALLBACK_URL updated
- [ ] CORS_ORIGIN updated
- [ ] FRONTEND_URL updated

## Testing

- [ ] Open frontend URL in browser
- [ ] Click "Sign in with Autodesk"
- [ ] Successfully authenticate
- [ ] Dashboard loads correctly
- [ ] Can view projects
- [ ] Can perform bulk operations

## Post-Deployment

- [ ] Credentials saved in password manager:
  - [ ] APS Client ID
  - [ ] APS Client Secret
  - [ ] SESSION_SECRET
  - [ ] ENCRYPTION_KEY
  - [ ] Railway Backend URL
  - [ ] Vercel Frontend URL

- [ ] Documentation updated with production URLs
- [ ] Team members notified
- [ ] Monitoring set up (optional):
  - [ ] UptimeRobot for uptime
  - [ ] Sentry for errors
  - [ ] Railway alerts configured

## Reference Commands

### View Logs

```bash
# Backend
cd backend
railway logs

# Worker
railway logs --service worker

# Frontend
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

### Check Status

```bash
# Railway services
railway status

# Vercel deployments
vercel ls
```

---

## Need Help?

- 📖 Detailed Guide: See `DEPLOY_NOW.md`
- 📋 Railway Guide: See `DEPLOY_TO_RAILWAY.md`
- 🚀 Production Guide: See `PRODUCTION.md`

---

**Completion Date:** _______________

**Deployed By:** _______________

**Notes:**
```
_____________________________________________

_____________________________________________

_____________________________________________
```
