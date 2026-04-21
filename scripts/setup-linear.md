# Linear.app Setup Instructions

## 🎯 Manual Setup Required

Since I can't access your Linear account directly, here are the steps to set up the workspace properly:

## Step 1: Create Teams

Go to Linear → Settings → Teams → Create Team:

1. **ENG** - Engineering
   - Description: Backend/Frontend development
   - Color: Blue
   - Key: ENG

2. **DSN** - Design System
   - Description: Component library & design tokens
   - Color: Purple
   - Key: DSN

3. **DOC** - Documentation
   - Description: Engineering documentation & standards
   - Color: Green
   - Key: DOC

4. **QA** - Quality Assurance
   - Description: Testing & quality control
   - Color: Orange
   - Key: QA

5. **PROD** - Product Management
   - Description: Product planning & roadmaps
   - Color: Pink
   - Key: PROD

6. **BA** - Business Analysis
   - Description: Process optimization & metrics
   - Color: Teal
   - Key: BA

## Step 2: Configure Workflow

Go to Linear → Settings → Workflows:

**Create workflow states:**
1. **Backlog** (gray) - Ideas & requests
2. **Todo** (blue) - Ready for work
3. **In Progress** (yellow) - Actively working
4. **In Review** (purple) - Code/design review
5. **Ready for QA** (orange) - Ready for testing
6. **Done** (green) - Completed

**Add additional states:**
- **Blocked** (red) - Waiting on dependencies
- **Canceled** (gray) - Won't do

## Step 3: Create Labels

Go to Linear → Settings → Labels:

**Priority labels:**
- `priority:high` (red)
- `priority:medium` (yellow)
- `priority:low` (gray)

**Type labels:**
- `bug` (red)
- `feature` (blue)
- `documentation` (green)
- `chore` (gray)

**Status labels:**
- `blocked` (red)
- `needs-info` (orange)
- `good-first-issue` (green)

## Step 4: Create Initial Issues

**Create these foundational issues:**

### ORA-1: Set up design system repository
- **Team:** DSN
- **Assignee:** Design System Platform Engineer
- **Priority:** High
- **Labels:** feature, priority:high
- **Description:** Create `storyhouse-design-system` repository with TypeScript, Storybook, Astro docs

### ORA-2: Implement engineering workflow
- **Team:** DOC
- **Assignee:** Documentation Specialist
- **Priority:** High
- **Labels:** documentation, priority:high
- **Description:** Document PR review process, QA integration, development standards

### ORA-3: Create HR Dashboard ↔ Linear integration
- **Team:** ENG
- **Assignee:** Head Engineer
- **Priority:** Medium
- **Labels:** feature, priority:medium
- **Description:** Integrate Linear webhooks with Orange HR Dashboard

### ORA-4: Hire Business Analyst
- **Team:** BA
- **Assignee:** Head Engineer
- **Priority:** High
- **Labels:** chore, priority:high
- **Description:** Hire BA to own Linear workspace and process optimization

### ORA-5: Set up QA testing framework
- **Team:** QA
- **Assignee:** (Unassigned - hire QA engineer)
- **Priority:** Medium
- **Labels:** feature, priority:medium
- **Description:** Create testing infrastructure and automation

## Step 5: Set Up API & Webhooks

### API Key:
1. Go to Linear → Settings → API
2. Create new personal API key
3. Copy to `.env` file:
```
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxx
```

### Webhook:
1. Go to Linear → Settings → Webhooks
2. Create webhook to: `http://localhost:3003/webhook/linear`
3. Select events: `Issue.created`, `Issue.updated`, `Issue.deleted`
4. Copy webhook secret to `.env`:
```
LINEAR_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
```

## Step 6: GitHub Integration

1. Go to Linear → Settings → Integrations → GitHub
2. Connect to GitHub repository
3. Enable issue sync
4. Configure mapping:
   - Linear teams ↔ GitHub labels
   - Linear states ↔ GitHub statuses

## 🚀 Ready for Business Analyst

Once setup is complete, the Business Analyst (when hired) will:
1. **Own the workspace** - Full admin access
2. **Optimize workflows** - Based on team feedback
3. **Create roadmaps** - Quarterly planning
4. **Track velocity** - Team performance metrics
5. **Generate reports** - Stakeholder updates

## 📊 Integration Status

**Current status:** Mock integration ready
**Real integration:** Requires API key & webhook setup
**HR Dashboard:** Shows mock Linear activities
**WebSocket:** Ready for real-time updates

## 🔧 Testing the Integration

**Test webhook (curl command):**
```bash
curl -X POST http://localhost:3003/webhook/linear \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "type": "Issue",
    "data": {
      "id": "test-123",
      "identifier": "ORA-99",
      "title": "Test Linear Integration",
      "state": { "name": "Todo" },
      "assignee": { "name": "Test User", "displayName": "Test User" },
      "team": { "name": "ENG" }
    }
  }'
```

**Check Linear issues:**
```bash
curl http://localhost:3003/api/linear/issues
```

## 🎯 Next Steps

1. **Complete manual setup** (teams, workflows, issues)
2. **Get API credentials** and update `.env`
3. **Test real integration** with webhooks
4. **Hire Business Analyst** to take ownership
5. **Expand integration** (cycles, roadmaps, analytics)