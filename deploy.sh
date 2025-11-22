#!/usr/bin/env bash
set -euo pipefail

#
# Keystroke Symphony - Quick Deployment Script
# Deploys to Cloudflare Pages via Wrangler CLI
#

echo "🎵 Keystroke Symphony - Cloudflare Pages Deployment"
echo "======================================================"
echo ""

# Check if wrangler is installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npm/npx not found. Please install Node.js."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check deployment type
DEPLOY_TYPE="${1:-production}"

if [ "$DEPLOY_TYPE" == "preview" ]; then
    echo "🔍 Deploying PREVIEW build..."
    echo ""
    echo "Building..."
    npm run build
    echo ""
    echo "Deploying to Cloudflare Pages (preview)..."
    npx wrangler pages deploy dist
elif [ "$DEPLOY_TYPE" == "production" ]; then
    echo "🚀 Deploying PRODUCTION build..."
    echo ""
    echo "⚠️  WARNING: This will deploy to production!"
    echo "Make sure GEMINI_API_KEY is set in Cloudflare Pages dashboard."
    echo ""
    read -p "Continue? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
    echo ""
    echo "Building for production..."
    npm run build:production
    echo ""
    echo "Deploying to Cloudflare Pages (production)..."
    npx wrangler pages deploy dist --branch=main
else
    echo "❌ Error: Invalid deployment type. Use 'preview' or 'production'."
    echo "Usage: ./deploy.sh [preview|production]"
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Visit Cloudflare Pages dashboard to view deployment"
echo "2. Verify environment variables are set (GEMINI_API_KEY)"
echo "3. Test the deployed app"
echo ""
