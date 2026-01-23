#!/bin/bash

# Railway Deployment Helper Script
# This script helps you deploy ACC User Manager to Railway securely

set -e

echo "=== ACC User Manager - Railway Deployment ==="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found"
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

echo "✅ Railway CLI is installed"
echo ""

# Login to Railway
echo "Please login to Railway:"
railway login

echo ""
echo "=== Setting up Railway project ==="
echo ""

# Link to project or create new one
echo "Do you want to:"
echo "1) Link to existing Railway project"
echo "2) Create new Railway project"
read -p "Enter choice (1 or 2): " project_choice

if [ "$project_choice" = "1" ]; then
    railway link
elif [ "$project_choice" = "2" ]; then
    railway init
else
    echo "Invalid choice"
    exit 1
fi

echo ""
echo "=== Adding PostgreSQL and Redis ==="
echo ""

# Add PostgreSQL
echo "Adding PostgreSQL..."
railway add --plugin postgresql || echo "PostgreSQL may already exist"

# Add Redis
echo "Adding Redis..."
railway add --plugin redis || echo "Redis may already exist"

echo ""
echo "✅ Database services added"
echo ""

# Prompt for environment variables
echo "=== Configure Environment Variables ==="
echo ""
echo "Please provide the following credentials:"
echo ""

read -p "APS Client ID: " APS_CLIENT_ID
read -sp "APS Client Secret (hidden): " APS_CLIENT_SECRET
echo ""

# Generate secrets
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

echo ""
echo "✅ Generated SESSION_SECRET and ENCRYPTION_KEY"
echo ""

# Get Railway URLs (will be set after first deployment)
echo "Note: Callback URL will be updated after deployment"
echo ""

read -p "Enter your custom domain (or press Enter to skip): " CUSTOM_DOMAIN

if [ -z "$CUSTOM_DOMAIN" ]; then
    echo "You'll update the callback URL after getting the Railway URL"
else
    FRONTEND_URL="https://$CUSTOM_DOMAIN"
fi

echo ""
echo "=== Setting Environment Variables for Backend ==="
echo ""

# Set backend environment variables
railway variables set NODE_ENV=production
railway variables set APS_CLIENT_ID="$APS_CLIENT_ID"
railway variables set APS_CLIENT_SECRET="$APS_CLIENT_SECRET"
railway variables set SESSION_SECRET="$SESSION_SECRET"
railway variables set ENCRYPTION_KEY="$ENCRYPTION_KEY"

# Set LOG_LEVEL
railway variables set LOG_LEVEL=info

# Set rate limiting
railway variables set RATE_LIMIT_WINDOW_MS=900000
railway variables set RATE_LIMIT_MAX_REQUESTS=100

echo "✅ Backend environment variables set"
echo ""

# Create worker service
echo "=== Creating Worker Service ==="
railway service create worker || echo "Worker service may already exist"

# Set worker environment variables
echo "Setting worker environment variables..."
railway variables set --service worker NODE_ENV=production
railway variables set --service worker APS_CLIENT_ID="$APS_CLIENT_ID"
railway variables set --service worker APS_CLIENT_SECRET="$APS_CLIENT_SECRET"
railway variables set --service worker SESSION_SECRET="$SESSION_SECRET"
railway variables set --service worker ENCRYPTION_KEY="$ENCRYPTION_KEY"
railway variables set --service worker QUEUE_CONCURRENCY=3

echo "✅ Worker environment variables set"
echo ""

# Deploy backend
echo "=== Deploying Backend ==="
cd backend
railway up
echo "✅ Backend deployed"

# Run migrations
echo ""
echo "=== Running Database Migrations ==="
railway run npm run migrate
echo "✅ Migrations completed"

cd ..

# Deploy worker
echo ""
echo "=== Deploying Worker ==="
cd backend
railway up --service worker
echo "✅ Worker deployed"
cd ..

echo ""
echo "=== Deployment Complete! ==="
echo ""

# Get backend URL
echo "Getting your Railway URLs..."
BACKEND_URL=$(railway domain)

echo ""
echo "📋 Deployment Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backend URL: $BACKEND_URL"
echo ""
echo "🔧 Next Steps:"
echo ""
echo "1. Update your APS app callback URL to:"
echo "   https://your-frontend-url/api/auth/callback"
echo ""
echo "2. Update backend environment variables:"
echo "   railway variables set APS_CALLBACK_URL=https://your-frontend-url/api/auth/callback"
echo "   railway variables set CORS_ORIGIN=https://your-frontend-url"
echo "   railway variables set FRONTEND_URL=https://your-frontend-url"
echo ""
echo "3. Deploy frontend to Vercel:"
echo "   cd frontend"
echo "   vercel --prod"
echo "   vercel env add NEXT_PUBLIC_API_URL production"
echo "   (Enter: $BACKEND_URL)"
echo ""
echo "4. Test your deployment:"
echo "   curl $BACKEND_URL/health"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Backend and Worker are now live on Railway!"
echo ""
echo "Save these for later:"
echo "SESSION_SECRET: $SESSION_SECRET"
echo "ENCRYPTION_KEY: $ENCRYPTION_KEY"
echo ""
