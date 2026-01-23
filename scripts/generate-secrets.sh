#!/bin/bash

# Generate secure secrets for deployment
# Run this script and save the output securely

echo "=== ACC User Manager - Secret Generation ==="
echo ""
echo "Generating secure secrets for your deployment..."
echo ""

# Generate SESSION_SECRET
SESSION_SECRET=$(openssl rand -hex 32)

# Generate ENCRYPTION_KEY
ENCRYPTION_KEY=$(openssl rand -hex 32)

echo "✅ Secrets generated successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 SAVE THESE VALUES SECURELY:"
echo ""
echo "SESSION_SECRET=$SESSION_SECRET"
echo ""
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Usage in Railway:"
echo ""
echo "railway variables set SESSION_SECRET=$SESSION_SECRET"
echo "railway variables set ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""
echo "For worker service:"
echo ""
echo "railway variables set --service worker SESSION_SECRET=$SESSION_SECRET"
echo "railway variables set --service worker ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔒 Security Tips:"
echo "1. Store these in a password manager"
echo "2. Never commit these to git"
echo "3. Use the same values for backend and worker"
echo "4. Keep them secret!"
echo ""
