#!/bin/bash

echo "🚀 Setting up Cloudflare Tunnel for Orange HR Dashboard"
echo "======================================================"

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared not found. Installing..."
    brew install cloudflared
fi

echo "✅ cloudflared installed"

echo ""
echo "📋 Setup Steps:"
echo ""
echo "1. Login to Cloudflare (opens browser):"
echo "   cloudflared tunnel login"
echo ""
echo "2. Create tunnel:"
echo "   cloudflared tunnel create orange-hr-dashboard"
echo ""
echo "3. Configure DNS (creates hr.orangedoorhouse.com):"
echo "   cloudflared tunnel route dns orange-hr-dashboard hr.orangedoorhouse.com"
echo ""
echo "4. Start tunnel:"
echo "   cloudflared tunnel --config ~/.cloudflared/config.yml run orange-hr-dashboard"
echo ""
echo "🎯 After tunnel is running:"
echo "- Update Linear webhook to: https://hr.orangedoorhouse.com/webhook/linear"
echo "- Test by creating issue in Linear"
echo "- Check HR Dashboard Activity Feed"
echo ""
echo "📊 Alternative (quick test with random subdomain):"
echo "   cloudflared tunnel --url http://localhost:3003"
echo "   (Gives you: https://orange-hr-dashboard.trycloudflare.com)"
echo ""
echo "Ready to set up? Run the commands above in order."