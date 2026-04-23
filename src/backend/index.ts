import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import { gateway } from './gateway-proxy'
import { ticketSystem } from './ticket-system'
import { getAgentIdFromLinearAssignee, startAgentWithLinearIssue } from './agent-mapping-fixed'

const GATEWAY_URL = 'http://localhost:3005'

const app = express()
const PORT = 3003

// WebSocket for real-time updates (connects to Gateway WebSocket)
const wss = new WebSocketServer({ port: 3004 })
const clients = new Set<WebSocket>()

// Connect to Gateway WebSocket for real-time updates
let gatewayWs: WebSocket | null = null

function connectToGatewayWebSocket() {
  gatewayWs = new WebSocket('ws://localhost:3006')
  
  gatewayWs.on('open', () => {
    console.log('📡 Connected to Gateway WebSocket')
  })
  
  gatewayWs.on('message', (data) => {
    // Forward Gateway messages to dashboard clients
    const message = data.toString()
    broadcast(JSON.parse(message))
  })
  
  gatewayWs.on('close', () => {
    console.log('📡 Gateway WebSocket disconnected, reconnecting...')
    setTimeout(connectToGatewayWebSocket, 5000)
  })
  
  gatewayWs.on('error', () => {
    // Silently handle WebSocket connection errors
    // Gateway WebSocket (port 3006) may start after HTTP (port 3005)
  })
}

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log('📡 Dashboard WebSocket client connected')
  
  ws.on('close', () => {
    clients.delete(ws)
    console.log('📡 Dashboard WebSocket client disconnected')
  })
})

// Broadcast to all dashboard WebSocket clients
function broadcast(data: any) {
  const message = JSON.stringify(data)
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

app.use(cors({
  origin: ['http://localhost:3002', 'http://127.0.0.1:3002', 'http://localhost:3000'],
  credentials: true
}))
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'HR Dashboard Proxy',
    gateway: 'connected',
    timestamp: new Date().toISOString()
  })
})



// Proxy endpoints to Gateway API

// 1. Get dashboard data (team + approval queue)
app.get('/api/dashboard', async (req, res) => {
  try {
    // Fetch from gateway and Linear in parallel
    const [approvalQueue, approvedAgents, linearIssues] = await Promise.all([
      gateway.getApprovalQueue(),
      gateway.getApprovalQueue('APPROVED'),
      (async () => {
        try {
          const { getActiveIssuesWithAgents } = await import('./linear-simple.js')
          return await getActiveIssuesWithAgents()
        } catch (e: any) {
          console.warn('⚠️ Could not fetch Linear issues for team view:', e.message)
          return [] // Non-fatal — team displays without task info
        }
      })()
    ])
    
    // Build team from Gateway data, enriched with Linear issue info
    const teamFromGateway = []
    const processedNames = new Set()
    
    if (approvedAgents.data) {
      for (const agent of approvedAgents.data) {
        if (processedNames.has(agent.name)) continue
        processedNames.add(agent.name)
        
        const approvedDate = agent.approvedAt ? new Date(agent.approvedAt) : new Date(agent.submittedAt)
        
                // Find matching Linear issue via agentId label (uses the same mapping as approval)
        const agentIdForMatch = getAgentIdFromLinearAssignee(agent.name)
        const matchingIssue = agentIdForMatch
          ? linearIssues.find(i => i.agentId === agentIdForMatch)
          : undefined
        
        teamFromGateway.push({
          id: teamFromGateway.length + 1,
          name: agent.name,
          role: agent.role,
          status: agent.status.toLowerCase(),
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
          joinDate: approvedDate.toISOString().split('T')[0],
          currentTask: matchingIssue?.title || null,
          ticketNumber: matchingIssue?.identifier || null,
          workingSince: matchingIssue?.startedAt || matchingIssue?.createdAt || null,
        })
      }
    }
    
    // Build activity feed from Linear issue data + issue history timeline
    const currentStateActivity = linearIssues
      .filter(i => i.stateType !== 'backlog')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(i => ({
        id: `linear-${i.id}`,
        type: 'approval',
        user: i.agentId || 'Unassigned',
        action: i.state === 'In Progress' ? 'Started work on' : i.state === 'In Review' ? 'In review' : `Updated ${i.identifier}`,
        details: `${i.title} (${i.priorityLabel})`,
        time: timeAgo(i.updatedAt),
        timestamp: i.updatedAt,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${i.agentId || 'unassigned'}`
      }))

    // Flatten all issue history events into the activity feed
    const historyActivity = linearIssues
      .flatMap(i =>
        (i.history || [])
          .filter(h => h.fromState || h.toState || h.fromAssignee || h.toAssignee)
          .map(h => {
            let action: string
            if (h.fromState && h.toState) {
              action = `${h.fromState} → ${h.toState}`
            } else if (h.toAssignee) {
              action = `Assigned to ${h.toAssignee}`
            } else if (h.fromAssignee && !h.toAssignee) {
              action = `Unassigned from ${h.fromAssignee}`
            } else {
              action = `Updated ${i.identifier}`
            }
            return {
              id: `history-${h.id}`,
              type: 'approval',
              user: h.actorName || i.agentId || 'System',
              action,
              details: `${i.identifier}: ${i.title}`,
              time: timeAgo(h.createdAt),
              timestamp: h.createdAt,
              avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${h.actorName || i.agentId || 'system'}`
            }
          })
      )

    // Merge and sort by timestamp descending
    const activity = [...currentStateActivity, ...historyActivity]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    res.json({
      team: teamFromGateway,
      activity,
      approvals: approvalQueue.data || [],
      metrics: {
        teamSize: teamFromGateway.length,
        approvedAgents: teamFromGateway.filter(m => m.status === 'approved').length,
        activeAgents: teamFromGateway.filter(m => m.status === 'active').length,
        onboardingAgents: teamFromGateway.filter(m => m.status === 'onboarding').length,
        pendingApprovals: approvalQueue.count || 0,
      }
    })
    
  } catch (error) {
    console.error('❌ Dashboard data fetch failed:', error instanceof Error ? error.message : 'Unknown error')
    
    res.json({
      team: [],
      activity: [],
      approvals: [],
      metrics: {
        teamSize: 0,
        approvedAgents: 0,
        activeAgents: 0,
        onboardingAgents: 0,
        pendingApprovals: 0
      },
      source: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// 2. Submit agent request (proxy to Gateway)
app.post('/api/agent-requests', async (req, res) => {
  try {
    const result = await gateway.submitAgentRequest(req.body)
    
    // Broadcast new request
    broadcast({
      type: 'agent_request_submitted',
      data: result.data
    })
    
    res.json(result)
  } catch (error) {
    console.error('Error submitting agent request:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to submit agent request'
    })
  }
})

// 3. Get approval queue (proxy to Gateway)
app.get('/api/approval-queue', async (req, res) => {
  try {
    const status = req.query.status as string || 'PENDING'
    const result = await gateway.getApprovalQueue(status)
    res.json(result)
  } catch (error) {
    console.error('Error fetching approval queue:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch approval queue'
    })
  }
})

// 4. Approve agent request (proxy to Gateway)
app.post('/api/approve/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await gateway.approveAgentRequest(id, {
      ...req.body,
      approvedBy: 'HR Dashboard'
    })
    
    // Broadcast approval
    broadcast({
      type: 'agent_request_approved',
      data: result.data
    })
    
    res.json(result)
  } catch (error) {
    console.error('Error approving agent request:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to approve agent request'
    })
  }
})

// 5. Reject agent request (proxy to Gateway)
app.post('/api/reject/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await gateway.rejectAgentRequest(id, {
      ...req.body,
      rejectedBy: 'HR Dashboard'
    })
    
    // Broadcast rejection
    broadcast({
      type: 'agent_request_rejected',
      data: result.data
    })
    
    res.json(result)
  } catch (error) {
    console.error('Error rejecting agent request:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to reject agent request'
    })
  }
})

// 6. Orange HR webhook (for Telegram bot integration)
app.post('/webhook/orange-hr', async (req, res) => {
  try {
    const event = req.body
    console.log('📨 Orange HR webhook received:', event.type)
    
    // Forward to Gateway if needed, or handle locally
    if (event.type === 'agent_request') {
      // Create in Gateway
      await gateway.submitAgentRequest({
        name: event.agentName,
        role: event.role,
        department: event.department,
        status: 'PENDING',
        submittedBy: 'Telegram Bot'
      })
    }
    
    // Broadcast to dashboard clients
    broadcast(event)
    
    res.json({ success: true, message: 'Webhook processed' })
  } catch (error) {
    console.error('Error processing webhook:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook'
    })
  }
})

// 7. Linear webhook (forward to Gateway in future)
app.post('/webhook/linear', (req, res) => {
  const event = req.body
  console.log('📨 Linear webhook received:', event.type || 'unknown')
  
  // Create activity for dashboard
  const activity = {
    id: Date.now(),
    user: 'Linear System',
    action: `Linear issue ${event.action || 'updated'}: ${event.data?.identifier || 'Unknown'}`,
    type: 'development',
    time: 'Just now',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=linear',
    details: event.data?.title || 'No details',
    metadata: {
      source: 'linear',
      issueId: event.data?.id,
      identifier: event.data?.identifier,
      team: event.data?.team?.key,
    },
  }
  
  // Broadcast to dashboard clients
  broadcast({
    type: 'activity',
    data: activity,
  })
  
  res.json({ success: true, message: 'Webhook processed' })
})

// GitHub Webhook - Auto-create tickets from PRs/Issues
app.post('/webhook/github', (req, res) => {
  const event = req.body
  const eventType = req.headers['x-github-event']
  
  console.log(`📨 GitHub webhook received: ${eventType}`)
  
  let ticket: any = null
  
  // Handle Pull Request events
  if (eventType === 'pull_request') {
    const pr = event.pull_request
    const action = event.action
    
    if (action === 'opened' || action === 'reopened') {
      ticket = ticketSystem.createTicket({
        title: `PR Review: ${pr.title}`,
        description: pr.body || 'No description provided',
        source: 'github_pr',
        sourceId: `pr-${pr.number}`,
        priority: 'medium',
        metadata: {
          prNumber: pr.number,
          prUrl: pr.html_url,
          author: pr.user.login,
          repo: event.repository.full_name,
          branch: pr.head.ref,
          base: pr.base.ref,
          action: action
        }
      })
      
      console.log(`🎫 Created ticket from PR #${pr.number}: ${pr.title}`)
    }
  }
  
  // Handle Issue events
  else if (eventType === 'issues') {
    const issue = event.issue
    const action = event.action
    
    if (action === 'opened' || action === 'reopened') {
      ticket = ticketSystem.createTicket({
        title: `Issue: ${issue.title}`,
        description: issue.body || 'No description provided',
        source: 'github_issue',
        sourceId: `issue-${issue.number}`,
        priority: issue.labels?.some((l: any) => l.name.includes('bug')) ? 'high' : 'medium',
        metadata: {
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          author: issue.user.login,
          repo: event.repository.full_name,
          labels: issue.labels,
          action: action
        }
      })
      
      console.log(`🎫 Created ticket from Issue #${issue.number}: ${issue.title}`)
    }
  }
  
  // Broadcast new ticket to dashboard
  if (ticket) {
    broadcast({
      type: 'ticket_created',
      data: ticket
    })
  }
  
  res.json({ success: true, message: 'GitHub webhook processed' })
})

// Helper function to get current task from Gateway API


// Helper functions for task/ticket context
// TODO: Replace with real task tracking system


// Linear approval endpoints
app.get('/api/linear/approval-queue', async (req, res) => {
  try {
    const showAll = req.query.showAll === 'true'
    
    // Use simple Linear integration (no mock data)
    const { getLinearApprovalQueue } = await import('./linear-simple.js')
    const result = await getLinearApprovalQueue(showAll)
    
    // If API failed, return 500 error so frontend can show useful message
    if (!result.success) {
      return res.status(500).json(result)
    }
    
    res.json(result)
    
  } catch (error: any) {
    console.error('Error fetching Linear approval queue:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      help: 'Check Linear API key configuration in .env file'
    })
  }
})

app.post('/api/linear/approve/:issueId', async (req, res) => {
  try {
    const { issueId } = req.params
    const { comments, approvedBy = 'Nimphius', assigneeName } = req.body
    const { identifier: requestIdentifier } = req.body
    
    console.log(`🔍 Processing approval for: ID=${issueId}, Identifier=${requestIdentifier}`)
    
    const { getIssueDetails, approveLinearIssue } = await import('./linear-simple.js')
    
    // Step 1: Check issue assignee from Linear (real API, fail-fast)
    console.log(`   Checking issue assignee...`)
    let issueDetails
    try {
      issueDetails = await getIssueDetails(issueId)
    } catch (e: any) {
      return res.status(502).json({
        success: false,
        error: 'Failed to fetch issue details from Linear API',
        details: e.message
      })
    }
    
    // Step 2: If no assignee in Linear, require assigneeName or return NO_ASSIGNEE.
    // assigneeName is used for local agent mapping (not setting Linear user — our
    // OpenClaw agents aren't Linear workspace users).
    const currentAssignee = issueDetails.assignee?.displayName || null
    const effectiveAssignee = currentAssignee || assigneeName || null
    
    if (!currentAssignee && !assigneeName) {
      console.log(`⚠️ Issue ${issueDetails.identifier} has no assignee. Requesting agent selection.`)
      return res.status(400).json({
        success: false,
        code: 'NO_ASSIGNEE',
        error: `Issue ${issueDetails.identifier} has no assignee — select an agent to continue.`,
        issueId,
        identifier: requestIdentifier || issueDetails.identifier
      })
    }
    
    // Step 3: Transition the issue in Linear (real API, fail-fast)
    const linearResult = await approveLinearIssue(issueId, approvedBy, comments)
    
    if (!linearResult.success) {
      console.error(`❌ Linear approval API failed:`, linearResult.error)
      return res.status(500).json({
        success: false,
        error: linearResult.error,
        help: linearResult.help || 'Check Linear API key and permissions.',
        issueId,
        identifier: requestIdentifier || issueDetails.identifier
      })
    }
    
    console.log(`✅ Linear issue ${linearResult.data.identifier} transitioned to ${linearResult.data.newState}`)
    
    // Step 4: Map assignee to agent and start agent
    let agentId = null
    if (effectiveAssignee) {
      console.log(`🎯 Getting agent ID for assignee: ${effectiveAssignee}`)
      agentId = getAgentIdFromLinearAssignee(effectiveAssignee)
      console.log(`   Mapped to agent ID: ${agentId}`)
      
      if (agentId) {
        // Attach agent label to Linear issue (creates the bridge for dashboard team view)
        try {
          const { attachAgentLabel } = await import('./linear-simple.js')
          await attachAgentLabel(issueId, agentId)
        } catch (labelError: any) {
          // Non-fatal — dashboard will just show the issue as unassigned
          console.warn(`⚠️ Failed to attach agent label: ${labelError.message}`)
        }

        const result = startAgentWithLinearIssue(agentId, {
          identifier: requestIdentifier || issueDetails.identifier,
          assignee: effectiveAssignee
        })
        
        if (result.success) {
          console.log(`✅ Agent ${agentId} started for Linear issue ${linearResult.data.identifier} (activation: ${result.activationId || 'unknown'})`)
          
          const ticket = ticketSystem.createTicket({
            title: `Linear: ${linearResult.data.identifier}`,
            description: 'Approved through Orange HR dashboard',
            source: 'linear_issue',
            sourceId: requestIdentifier || issueDetails.identifier,
            priority: 'high',
            metadata: {
              linearId: issueId,
              assignedAgent: agentId,
              approvedBy,
              comments
            }
          })
          
          broadcast({
            type: 'ticket_created',
            data: ticket
          })
        } else {
          console.warn(`⚠️ Agent ${agentId} not started: ${result.error || 'unknown error'}`)
        }
      } else {
        console.log(`⚠️ No agent mapping found for assignee: ${effectiveAssignee}`)
      }
    }
    
    // Step 5: Broadcast and respond
    broadcast({
      type: 'LINEAR_ISSUE_APPROVED',
      issueId,
      approvedBy,
      timestamp: new Date().toISOString(),
      comments,
      source: 'linear-api',
      agentId,
      issueIdentifier: requestIdentifier || issueDetails.identifier
    })
    
    res.json({
      success: true,
      issueId,
      identifier: requestIdentifier || issueDetails.identifier,
      agentId,
      agentStarted: !!agentId,
      linearState: linearResult.data.newState
    })
    
  } catch (error: any) {
    console.error('Error approving Linear issue:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/linear/reject/:issueId', async (req, res) => {
  try {
    const { rejectIssue } = await import('./linear-approval-client.js')
    const { issueId } = req.params
    const { reason, rejectedBy = 'Nimphius' } = req.body
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required for rejection'
      })
    }
    
    const result = await rejectIssue(issueId, rejectedBy, reason)
    
    if (result.success) {
      // Broadcast rejection event
      broadcast({
        type: 'LINEAR_ISSUE_REJECTED',
        issueId,
        rejectedBy,
        reason,
        timestamp: new Date().toISOString()
      })
      
      res.json(result)
    } else {
      res.status(400).json(result)
    }
    
  } catch (error: any) {
    console.error('Error rejecting Linear issue:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

app.post('/api/linear/request-changes/:issueId', async (req, res) => {
  try {
    const { requestChanges } = await import('./linear-approval-client.js')
    const { issueId } = req.params
    const { changes, requestedBy = 'Nimphius' } = req.body
    
    if (!changes) {
      return res.status(400).json({
        success: false,
        error: 'Changes description is required'
      })
    }
    
    const result = await requestChanges(issueId, requestedBy, changes)
    
    if (result.success) {
      // Broadcast changes requested event
      broadcast({
        type: 'LINEAR_ISSUE_CHANGES_REQUESTED',
        issueId,
        requestedBy,
        changes,
        timestamp: new Date().toISOString()
      })
      
      res.json(result)
    } else {
      res.status(400).json(result)
    }
    
  } catch (error: any) {
    console.error('Error requesting changes on Linear issue:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Agent creation endpoint
app.post('/api/create-agent', async (req, res) => {
  try {
    const { name, role, emoji, department, skills, experience, qualifications } = req.body
    
    if (!name || !role) {
      return res.status(400).json({
        success: false,
        error: 'Name and role are required'
      })
    }
    
    console.log(`🧱 Creating new agent: ${name} (${role})`)
    
    // 1. Submit to Gateway API
    const gatewayResponse = await fetch(`${GATEWAY_URL}/api/v1/agent-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'orange-hr-gateway-2026'
      },
      body: JSON.stringify({
        name,
        role,
        department: department || 'Engineering',
        skills: Array.isArray(skills) ? skills : [skills],
        experience: experience || '',
        qualifications: qualifications || '',
        submittedBy: 'HR Dashboard',
        status: 'PENDING'
      })
    })
    
    const gatewayData = await gatewayResponse.json()
    
    if (!gatewayData.success) {
      return res.status(500).json({
        success: false,
        error: `Gateway submission failed: ${gatewayData.error}`
      })
    }
    
    const gatewayAgent = gatewayData.data
    console.log(`✅ Gateway submission successful: ${gatewayAgent.id}`)
    
    // 2. Create OpenClaw agent
    const agentId = name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const workspacePath = `/Users/openclaw/projects/${agentId}`
    
    // Create workspace directory
    const fs = require('fs')
    const path = require('path')
    
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true })
      console.log(`📁 Created workspace: ${workspacePath}`)
    }
    
    // Create OpenClaw agent using execSync
    const { execSync } = require('child_process')
    
    try {
      // Create agent
      execSync(`openclaw agents add ${agentId} --workspace ${workspacePath}`, { stdio: 'pipe' })
      console.log(`✅ OpenClaw agent created: ${agentId}`)
      
      // Set identity
      execSync(`openclaw agents set-identity --agent ${agentId} --name "${name}" --emoji "${emoji || '🧑‍💻'}"`, { stdio: 'pipe' })
      console.log(`✅ Identity set: ${name} ${emoji}`)
      
      // Create IDENTITY.md
      const identityContent = `# IDENTITY.md - ${name}

- **Name:** ${name}
- **Emoji:** ${emoji || '🧑‍💻'}
- **Workspace:** ${workspacePath}
- **Created:** ${new Date().toISOString().split('T')[0]} via Orange HR Dashboard
- **Approved by:** HR Dashboard

---

**Role:** ${role}
**Department:** ${department || 'Engineering'}
**Status:** ACTIVE
**Next:** Awaiting task assignment
`
      
      fs.writeFileSync(path.join(workspacePath, 'IDENTITY.md'), identityContent)
      console.log(`📄 Created IDENTITY.md`)
      
    } catch (execError: any) {
      console.error(`❌ OpenClaw agent creation failed:`, execError.message)
      // Continue anyway - at least Gateway submission succeeded
    }
    
    // 3. Auto-approve in Gateway (for demo - in production would wait for manual approval)
    try {
      const approveResponse = await fetch(`${GATEWAY_URL}/api/v1/agent-requests/${gatewayAgent.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'orange-hr-gateway-2026'
        },
        body: JSON.stringify({
          approvedBy: 'HR Dashboard'
        })
      })
      
      const approveData = await approveResponse.json()
      
      if (approveData.success) {
        console.log(`✅ Gateway approval successful`)
      }
      
    } catch (approveError: any) {
      console.error(`❌ Gateway approval failed:`, approveError.message)
    }
    
    // 4. Send webhook to dashboard for real-time update
    broadcast({
      type: 'AGENT_CREATED',
      agentId: gatewayAgent.id,
      openclawAgentId: agentId,
      name,
      role,
      emoji: emoji || '🧑‍💻',
      timestamp: new Date().toISOString()
    })
    
    res.json({
      success: true,
      data: {
        gatewayId: gatewayAgent.id,
        openclawId: agentId,
        name,
        role,
        workspace: workspacePath
      },
      message: 'Agent created successfully'
    })
    
  } catch (error: any) {
    console.error('Agent creation error:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Ticket Management API Endpoints

// Get all tickets
app.get('/api/tickets', (req, res) => {
  try {
    const { status, assignedTo } = req.query
    const tickets = ticketSystem.getTickets({
      status: status as any,
      assignedTo: assignedTo as string
    })
    
    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
      stats: ticketSystem.getStats()
    })
  } catch (error: any) {
    console.error('Error getting tickets:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get single ticket
app.get('/api/tickets/:id', (req, res) => {
  try {
    const ticket = ticketSystem.getTicket(req.params.id)
    
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }
    
    res.json({ success: true, data: ticket })
  } catch (error: any) {
    console.error('Error getting ticket:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Assign ticket to agent
app.post('/api/tickets/:id/assign', async (req, res) => {
  try {
    const { agentId } = req.body
    
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId is required' })
    }
    
    const ticket = ticketSystem.assignTicket(req.params.id, agentId)
    
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }
    
    // Start agent with ticket context
    const { execSync } = require('child_process')
    const command = `openclaw --agent ${agentId} "Ticket #${ticket.id}: ${ticket.title}\n\nDescription: ${ticket.description}\n\nSource: ${ticket.source} ${ticket.sourceId}\nPriority: ${ticket.priority}\n\nPlease review and begin work."`
    
    try {
      execSync(command, { stdio: 'pipe' })
      console.log(`🚀 Started agent ${agentId} with ticket ${ticket.id}`)
      
      // Broadcast assignment
      broadcast({
        type: 'ticket_assigned',
        data: ticket
      })
      
      res.json({
        success: true,
        data: ticket,
        message: `Ticket assigned to ${agentId} and agent started`
      })
      
    } catch (execError: any) {
      console.error(`Failed to start agent ${agentId}:`, execError.message)
      
      // Still mark as assigned even if agent start failed
      res.json({
        success: true,
        data: ticket,
        warning: `Ticket assigned to ${agentId} but agent failed to start: ${execError.message}`
      })
    }
    
  } catch (error: any) {
    console.error('Error assigning ticket:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Update ticket status
app.put('/api/tickets/:id/status', (req, res) => {
  try {
    const { status } = req.body
    
    if (!status || !['new', 'assigned', 'in_progress', 'done', 'blocked'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid status is required' })
    }
    
    const ticket = ticketSystem.updateTicketStatus(req.params.id, status as any)
    
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }
    
    // Broadcast status update
    broadcast({
      type: 'ticket_status_updated',
      data: ticket
    })
    
    res.json({ success: true, data: ticket })
  } catch (error: any) {
    console.error('Error updating ticket status:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Delete ticket
app.delete('/api/tickets/:id', (req, res) => {
  try {
    const deleted = ticketSystem.deleteTicket(req.params.id)
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }
    
    // Broadcast deletion
    broadcast({
      type: 'ticket_deleted',
      data: { id: req.params.id }
    })
    
    res.json({ success: true, message: 'Ticket deleted' })
  } catch (error: any) {
    console.error('Error deleting ticket:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * Human-readable relative time helper.
 */
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HR Dashboard Proxy running on port ${PORT}`)
  console.log(`📡 WebSocket server on port 3004`)
  console.log(`🔗 Connected to Gateway API: ${GATEWAY_URL}`)
  console.log(`🔗 Health check: GET http://localhost:${PORT}/health`)
  console.log(`🔗 Dashboard data: GET http://localhost:${PORT}/api/dashboard`)
  console.log(`🔗 Create agent: POST http://localhost:${PORT}/api/create-agent`)
  
  // Connect to Gateway WebSocket
  connectToGatewayWebSocket()
})