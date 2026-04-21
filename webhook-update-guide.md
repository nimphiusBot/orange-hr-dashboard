# Linear Webhook Update Guide

## 🎯 After Railway Deployment

### Step 1: Get Railway URL
After `railway up` completes, run:
```bash
railway status
```
Copy the HTTPS URL (looks like: `https://orange-hr-dashboard.up.railway.app`)

### Step 2: Update Linear Webhook
1. Go to **Linear → Settings → Webhooks**
2. Find the **"Orange HR Dashboard"** webhook
3. Click **pencil icon** to edit
4. Update **URL** to: `https://YOUR-RAILWAY-URL.up.railway.app/webhook/linear`
5. Click **"Save"**

### Step 3: Test Integration
1. **Create test issue** in Linear:
   - Title: `Test Railway Webhook`
   - Click "Create"
2. **Check Railway logs:**
   ```bash
   railway logs
   ```
   Should show: `📨 Linear webhook received: Issue.create`
3. **Check HR Dashboard** (http://localhost:3002/)
   - Activity Feed should show new issue
   - Real-time update via WebSocket

## 🔧 Troubleshooting

### If webhook fails:
1. **Check Railway logs:**
   ```bash
   railway logs --tail
   ```

2. **Test endpoint manually:**
   ```bash
   curl https://YOUR-URL.up.railway.app/health
   ```
   Should return: `{"status":"ok"}`

3. **Verify environment variables:**
   ```bash
   railway variables list
   ```
   Ensure `LINEAR_API_KEY` is set

4. **Test webhook manually:**
   ```bash
   curl -X POST https://YOUR-URL.up.railway.app/webhook/linear \
     -H "Content-Type: application/json" \
     -d '{"action":"create","type":"Issue","data":{"id":"test","identifier":"ORA-TEST","title":"Manual Test"}}'
   ```

### If HR Dashboard doesn't update:
1. **Check WebSocket connection:**
   - Open browser DevTools (F12)
   - Go to Network → WS (WebSocket)
   - Should show connection to `ws://localhost:3004`

2. **Update frontend API URL (optional):**
   Create `.env.local` in frontend:
   ```
   VITE_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
   ```
   Restart frontend: `npm run dev`

## 📊 Expected Flow

```
Linear Issue Created → Railway HTTPS Webhook → HR Dashboard WebSocket → UI Update
       ↓                       ↓                       ↓               ↓
   ORA-XX created        Backend processes     Real-time broadcast   Activity Feed
   in Linear.app         webhook, fetches      to all clients        shows new issue
                         issue details via API
```

## 🎯 Success Indicators

1. ✅ **Railway deployment** - HTTPS URL working
2. ✅ **Linear webhook** - Updated to Railway URL
3. ✅ **Test issue** - Appears in HR Dashboard
4. ✅ **Real-time updates** - No page refresh needed
5. ✅ **Logs clean** - No errors in `railway logs`

## 📞 Support Resources

- **Railway Docs:** https://docs.railway.app
- **Linear Webhooks:** https://developers.linear.app/docs/graphql/webhooks
- **Project Directory:** `/Users/openclaw/projects/storyhouse-hr-dashboard`