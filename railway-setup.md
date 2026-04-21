# Railway Deployment Guide

## 🚀 Quick Deployment

### Step 1: Login to Railway
```bash
railway login
```
- Opens browser for authentication
- Login with GitHub or email
- Returns to terminal when complete

### Step 2: Initialize Project
```bash
cd /Users/openclaw/projects/storyhouse-hr-dashboard
railway init
```
- Creates new Railway project
- Links current directory

### Step 3: Set Environment Variables
```bash
# Set Linear API key
railway variables set LINEAR_API_KEY=lin_api_JdwKnABcckFSZR54HYbBBI9AVTxwLoZt8rF2kvgB

# Set other variables
railway variables set NODE_ENV=production
railway variables set PORT=3003
```

### Step 4: Deploy
```bash
railway up
```
- Builds and deploys to Railway
- Provides HTTPS URL (like: `https://orange-hr-dashboard.up.railway.app`)

### Step 5: Get Deployment URL
```bash
railway status
```
- Copy the HTTPS URL
- Update Linear webhook with this URL

## 📋 Environment Variables Needed

Add these via Railway dashboard or CLI:
```
LINEAR_API_KEY=lin_api_JdwKnABcckFSZR54HYbBBI9AVTxwLoZt8rF2kvgB
NODE_ENV=production
PORT=3003
```

## 🔧 Post-Deployment

### 1. Update Linear Webhook
- Go to Linear → Settings → Webhooks
- Edit existing webhook
- Change URL to: `https://YOUR-RAILWAY-URL.up.railway.app/webhook/linear`
- Save changes

### 2. Test Integration
1. Create issue in Linear
2. Check Railway logs: `railway logs`
3. Verify HR Dashboard updates

### 3. Update Local Development
Keep frontend local (http://localhost:3002) but point to Railway backend:
```bash
# In frontend, update API URL to Railway
VITE_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
```

## 🎯 Expected Result

**Railway provides:**
- HTTPS endpoint for Linear webhooks
- Automatic SSL certificates
- Free tier (500 hours/month)
- WebSocket support
- Automatic deployments

**Linear webhook URL:**
```
https://orange-hr-dashboard.up.railway.app/webhook/linear
```

## 🔍 Troubleshooting

**If deployment fails:**
```bash
# Check logs
railway logs

# Redeploy
railway up --verbose

# Check build
railway build
```

**If webhook fails:**
1. Check Railway logs
2. Verify environment variables
3. Test endpoint: `curl https://YOUR-URL.up.railway.app/health`

## 📞 Support

- Railway Docs: https://docs.railway.app
- Linear Webhook Docs: https://developers.linear.app/docs/graphql/webhooks
- HR Dashboard Code: `/Users/openclaw/projects/storyhouse-hr-dashboard`