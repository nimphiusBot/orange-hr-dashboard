# Linear.app Integration Guide

## 📋 Overview

Integration between Linear.app workspace (`orangedoorhouse`) and Orange HR Dashboard.

## 🔑 API Credentials Needed

**From Linear Settings → API:**
1. **Personal API Key** (for automation)
2. **Webhook Secret** (for receiving events)

**Required permissions:**
- Read access to issues, teams, cycles
- Write access to create issues
- Webhook creation permissions

## 🏗️ Workspace Structure

### Teams to Create:
1. **ENG** - Engineering (Backend/Frontend)
2. **DSN** - Design System  
3. **DOC** - Documentation
4. **QA** - Quality Assurance
5. **PROD** - Product Management
6. **BA** - Business Analysis

### Workflow States:
```
Backlog → Todo → In Progress → In Review → Ready for QA → Done
```

### Labels:
- `bug`, `feature`, `documentation`, `chore`
- `priority:high`, `priority:medium`, `priority:low`
- `blocked`, `needs-info`

## 🔗 Integration Setup

### Step 1: Create API Key
1. Go to Linear → Settings → API
2. Create new personal API key
3. Copy key to `.env` file:
```
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxx
```

### Step 2: Create Webhook
1. Go to Linear → Settings → Webhooks
2. Create webhook to: `http://localhost:3003/webhook/linear`
3. Select events: `Issue.created`, `Issue.updated`, `Issue.deleted`

### Step 3: Configure GitHub Sync
1. Linear → Settings → Integrations → GitHub
2. Connect GitHub repository
3. Enable issue sync

## 🚀 HR Dashboard Integration

### API Endpoints:
- `GET /api/linear/issues` - List all Linear issues
- `POST /api/linear/webhook` - Receive Linear webhooks
- `GET /api/linear/teams` - List Linear teams

### Data Flow:
```
Linear Issue Created → Webhook → HR Dashboard API → Activity Feed
Linear Issue Updated → Webhook → HR Dashboard API → Team Overview
```

### Dashboard Display:
- **Activity Feed:** "Linear issue created: [Title]"
- **Team Overview:** "[User] working on: [Issue]"
- **Progress:** Issue status updates

## 📊 Initial Tickets to Create

### Foundation Tickets:
1. **ORA-1** - Set up design system repository
2. **ORA-2** - Implement engineering workflow
3. **ORA-3** - Create HR Dashboard ↔ Linear integration  
4. **ORA-4** - Hire Business Analyst
5. **ORA-5** - Set up QA testing framework

### Team Assignments:
- **Design System Engineer:** ORA-1
- **Documentation Specialist:** ORA-2
- **Head Engineer:** ORA-3, ORA-4
- **Video Generation Assistant:** (TBD)

## 🛠️ Implementation Code

See `src/backend/linear-client.ts` for API client and `src/backend/webhooks/linear.ts` for webhook handler.

## 📝 Next Steps

1. **Get API credentials** from Linear
2. **Run setup script** to create teams/workflows
3. **Create initial tickets** via API
4. **Test webhook integration**
5. **Hand off to Business Analyst** once hired

## 🔒 Security Notes

- API keys stored in `.env` (never commit)
- Webhook signature verification
- Rate limiting on API calls
- Error logging and monitoring