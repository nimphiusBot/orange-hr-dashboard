#!/bin/bash

echo "🚀 Deploying Orange HR Dashboard to Railway"
echo "=========================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    brew install railway
fi

echo "✅ Railway CLI installed"

echo ""
echo "📋 Deployment Steps:"
echo "1. Login to Railway (opens browser):"
echo "   railway login"
echo ""
echo "2. Initialize project:"
echo "   railway init"
echo ""
echo "3. Set environment variables:"
echo "   railway variables set LINEAR_API_KEY=lin_api_JdwKnABcckFSZR54HYbBBI9AVTxwLoZt8rF2kvgB"
echo "   railway variables set NODE_ENV=production"
echo "   railway variables set PORT=3003"
echo ""
echo "4. Deploy:"
echo "   railway up"
echo ""
echo "5. Get URL:"
echo "   railway status"
echo ""
echo "🎯 After deployment:"
echo "- Update Linear webhook with Railway HTTPS URL"
echo "- Test by creating issue in Linear"
echo "- Check logs: railway logs"
echo ""
echo "Ready to deploy? Run the commands above in order."
echo ""
echo "For detailed instructions, see railway-setup.md"