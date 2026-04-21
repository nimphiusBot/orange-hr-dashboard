#!/bin/bash
# Complete Railway Deployment Script
# Run this once to fix all deployment issues

echo "🚀 Starting Railway deployment fix..."

# Step 1: Remove problematic files
echo "📦 Removing Dockerfile..."
rm -f Dockerfile

# Step 2: Add Railway configuration
echo "⚙️ Creating Railway config..."
cat > railway.json << 'EOF'
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "node deploy-server.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60
  }
}
EOF

# Step 3: Add ignore file
echo "📝 Creating .railwayignore..."
cat > .railwayignore << 'EOF'
node_modules/
.git/
.DS_Store
*.log
.env
*.pem
*.key
EOF

# Step 4: Update package.json if needed
echo "📄 Checking package.json..."
if ! grep -q '"start":' package.json; then
  echo "Adding start script to package.json..."
  npm set-script start "node deploy-server.js"
fi

# Step 5: Commit and push
echo "🔧 Committing changes..."
git add .
git commit -m "Fix Railway deployment: remove Dockerfile, add config" || echo "No changes to commit"

echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ DEPLOYMENT FIX COMPLETE!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Go to https://railway.app"
echo "2. Click on 'orange-hr-dashboard-api'"
echo "3. Click 'Redeploy'"
echo "4. Wait 2 minutes"
echo "5. Copy HTTPS URL"
echo "6. Update Linear webhook with that URL"
echo ""
echo "🛠️ If still fails, check Railway logs for specific errors."