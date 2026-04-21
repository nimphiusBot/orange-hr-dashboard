# One-Click Deployment

## 🚀 Deploy to Render.com (Recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/orange-doorhouse/storyhouse-hr-dashboard)

### Manual Deployment to Render:
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name:** `orange-hr-dashboard-api`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node deploy-server.js`
   - **Port:** `3003`
5. Add Environment Variables:
   - `LINEAR_API_KEY` = `lin_api_JdwKnABcckFSZR54HYbBBI9AVTxwLoZt8rF2kvgB`
   - `LINEAR_WEBHOOK_SECRET` = (get from Linear webhook)
   - `NODE_ENV` = `production`
   - `PORT` = `3003`
6. Click "Create Web Service"

## 🚀 Deploy to Railway

### Using Railway Dashboard:
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Railway auto-detects configuration
5. Add environment variables (same as above)
6. Deploy

### Using Railway CLI:
```bash
# Install CLI
brew install railway

# Login (opens browser)
railway login

# Initialize and deploy
cd /Users/openclaw/projects/storyhouse-hr-dashboard
railway init
railway variables set LINEAR_API_KEY=lin_api_JdwKnABcckFSZR54HYbBBI9AVTxwLoZt8rF2kvgB
railway variables set NODE_ENV=production
railway variables set PORT=3003
railway up
```

## 🚀 Deploy to Fly.io

```bash
# Install Fly CLI
brew install flyctl

# Login
flyctl auth login

# Launch
flyctl launch
# Follow prompts, select yes for:
# - Create app: yes
# - Select region: choose closest
# - Create database: no
# - Immediate deploy: yes

# Set secrets
flyctl secrets set LINEAR_API_KEY=lin_api_JdwKnABcckFSZR54HYbBBI9AVTxwLoZt8rF2kvgB
flyctl secrets set NODE_ENV=production
```

## 📋 Post-Deployment Steps

### 1. Get Your HTTPS URL
After deployment, you'll get a URL like:
- Render: `https://orange-hr-dashboard.onrender.com`
- Railway: `https://orange-hr-dashboard.up.railway.app`
- Fly.io: `https://orange-hr-dashboard.fly.dev`

### 2. Update Linear Webhook
1. Go to Linear → Settings → Webhooks
2. Edit "Orange HR Dashboard" webhook
3. Update URL to: `https://YOUR-DEPLOYMENT-URL/webhook/linear`
4. Save changes

### 3. Test Integration
1. Create issue in Linear
2. Check deployment logs
3. Verify HR Dashboard updates

## 🔧 Environment Variables

Required:
```
LINEAR_API_KEY=lin_api_JdwKnABcckFSZR54HYbBBI9AVTxwLoZt8rF2kvgB
NODE_ENV=production
PORT=3003
```

Optional (for webhook verification):
```
LINEAR_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

## 🎯 Quickest Path

**For immediate deployment, use Render.com:**
1. Click the "Deploy to Render" button above
2. Add environment variables
3. Get HTTPS URL in 2-3 minutes
4. Update Linear webhook
5. Test

## 📞 Support

- **Render Docs:** https://render.com/docs
- **Railway Docs:** https://docs.railway.app
- **Linear Webhooks:** https://developers.linear.app/docs/graphql/webhooks
- **Project Code:** `/Users/openclaw/projects/storyhouse-hr-dashboard`