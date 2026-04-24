import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import * as fs from 'fs'
import { WebSocketServer, WebSocket } from 'ws'
import { gateway } from './gateway-proxy'
import { ticketSystem } from './ticket-system'
import { getAgentIdFromLinearAssignee, startAgentWithLinearIssue } from './agent-mapping-fixed'
import { setBroadcast } from './linear-webhooks'
import { handleLinearWebhook } from './linear-webhooks'
import { syncGitHubTickets } from './github-integration'

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

// Wire up the Linear webhook handler's broadcaster
setBroadcast(broadcast)

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

// ─── Pipeline Status Management ────────────────────────────────────

interface PipelineState {
  currentStep: PipelineStepId
  steps: Array<{ id: PipelineStepId; label: string; description: string; completed: boolean; active: boolean; error?: string }>
  context?: {
    baIssue?: string
    emTickets?: string[]
    ctoIssue?: string
  }
}

type PipelineStepId = 'idle' | 'ba_started' | 'ba_ready' | 'em_reviewing' | 'em_approved' | 'cto_reviewing' | 'tickets_created' | 'agents_working' | 'complete'

const PIPELINE_DEFAULTS: PipelineState = {
  currentStep: 'idle',
  steps: [
    { id: 'idle', label: 'Awaiting Approval', description: 'CEO approves the first BA ticket to kick off the pipeline', completed: false, active: true },
    { id: 'ba_started', label: 'BA Analyzing', description: 'BA agent studies docs and drafts backlog', completed: false, active: false },
    { id: 'ba_ready', label: 'BA Ready', description: 'BA has draft backlog and needs EMs to review', completed: false, active: false },
    { id: 'em_reviewing', label: 'EMs Reviewing', description: 'Frontend EM + Backend EM review backlog', completed: false, active: false },
    { id: 'em_approved', label: 'EMs Approved', description: 'EMs approve backlog — ready to create tickets', completed: false, active: false },
    { id: 'cto_reviewing', label: 'CTO Review', description: 'Orange AI verifies backlog and pipeline health', completed: false, active: false },
    { id: 'tickets_created', label: 'Tickets Created', description: 'BA creates Linear tickets with agent:xxx labels', completed: false, active: false },
    { id: 'agents_working', label: 'Agents Working', description: 'Automated pipeline executing — agents in flight', completed: false, active: false },
    { id: 'complete', label: 'Pipeline Complete', description: 'All work done and reviewed', completed: false, active: false },
  ]
}

// In-memory pipeline state (survives restarts in dev)
let pipelineState: PipelineState = { ...PIPELINE_DEFAULTS, steps: PIPELINE_DEFAULTS.steps.map(s => ({ ...s })) }

// Load persisted state from file
function loadPipelineState(): void {
  try {
    const statePath = '/tmp/pipeline-state.json'
    if (fs.existsSync(statePath)) {
      const saved = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      pipelineState = saved
      console.log('📋 Loaded pipeline state from disk')
    }
  } catch (e: any) {
    // Start fresh
  }
}

function savePipelineState(): void {
  try {
    fs.writeFileSync('/tmp/pipeline-state.json', JSON.stringify(pipelineState, null, 2))
  } catch (e: any) {
    // Non-fatal
  }
}

loadPipelineState()

// GET current pipeline status
app.get('/api/pipeline/status', (req, res) => {
  res.json({ pipeline: pipelineState })
})

// GET enriched pipeline workflow data for the Workflow page
app.get('/api/pipeline/workflow', async (req, res) => {
  try {
    const { getActiveIssuesWithAgents } = await import('./linear-simple.js');
    const [linearIssues, gatewayAgents] = await Promise.all([
      getActiveIssuesWithAgents(),
      gateway.getApprovalQueue('APPROVED').catch(() => ({ data: [] }))
    ]);

    const now = new Date();

    // Group all issues by Linear state
    const states: Record<string, { count: number; tickets: any[] }> = {
      Backlog: { count: 0, tickets: [] },
      Todo: { count: 0, tickets: [] },
      'In Progress': { count: 0, tickets: [] },
      'In Review': { count: 0, tickets: [] },
      Blocked: { count: 0, tickets: [] },
      Done: { count: 0, tickets: [] },
    };

    // Build a set of all known ORA state names from Linear
    // (in case we hit a state not in our predefined map)
    const stateMap: Record<string, string> = {};

    for (const issue of linearIssues) {
      const stateName = issue.state || 'Todo';
      stateMap[stateName] = stateName;

      const agentLabel = issue.agentId || null;
      const timeSinceUpdate = Math.floor((now.getTime() - new Date(issue.updatedAt).getTime()) / 1000);

      const ticket = {
        identifier: issue.identifier,
        title: issue.title,
        state: stateName,
        priority: issue.priorityLabel,
        agentId: agentLabel,
        updatedAt: issue.updatedAt,
        timeSinceUpdate,
      };

      if (states[stateName]) {
        states[stateName].count++;
        states[stateName].tickets.push(ticket);
      }
    }

    // Build agent status from gateway + Linear ticket presence
    const pipelineOrder = ['ba-platform', 'frontend-em', 'backend-em', 'design-system-engineer', 'documentation-specialist', 'main', 'qa-expert'];
    const agents: Record<string, any> = {};

    for (const agentId of pipelineOrder) {
      const currentIssue = linearIssues.find(i => i.agentId === agentId && i.state === 'In Progress');
      const latestIssue = [...linearIssues]
        .filter(i => i.agentId === agentId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

      const displayName = agentId === 'ba-platform' ? 'Business Analyst' :
        agentId === 'frontend-em' ? 'Frontend EM' :
        agentId === 'backend-em' ? 'Backend EM' :
        agentId === 'design-system-engineer' ? 'DS Engineer' :
        agentId === 'documentation-specialist' ? 'Doc Specialist' :
        agentId === 'main' ? 'CTO (Orange AI)' :
        agentId === 'qa-expert' ? 'QA' : agentId;

      agents[agentId] = {
        id: agentId,
        name: displayName,
        status: currentIssue ? 'working' : 'idle',
        currentTicket: currentIssue ? { identifier: currentIssue.identifier, title: currentIssue.title } : null,
        lastCompleted: latestIssue && latestIssue.identifier !== currentIssue?.identifier ? latestIssue.identifier : null,
        totalTickets: linearIssues.filter(i => i.agentId === agentId).length,
        pipelinePosition: pipelineOrder.indexOf(agentId) + 1,
      };
    }

    // Build transitions from Linear issue history
    const transitions: any[] = [];
    for (const issue of linearIssues) {
      if (issue.history) {
        for (const h of issue.history) {
          if (h.fromState && h.toState) {
            transitions.push({
              issueId: issue.identifier,
              title: issue.title,
              fromState: h.fromState,
              toState: h.toState,
              actor: h.actorName || issue.agentId || 'System',
              timestamp: h.createdAt,
              timeAgo: timeAgo(h.createdAt)
            });
          }
        }
      }
    }
    transitions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      pipeline: pipelineState,
      states,
      agents,
      recentTransitions: transitions.slice(0, 20),
      pipelineChain: pipelineOrder,
      totalTickets: linearIssues.length,
    });
  } catch (error) {
    console.error('❌ Workflow data fetch failed:', error instanceof Error ? error.message : 'Unknown error');
    res.json({
      pipeline: pipelineState,
      states: {},
      agents: {},
      recentTransitions: [],
      pipelineChain: ['ba-platform', 'frontend-em', 'backend-em', 'design-system-engineer', 'documentation-specialist', 'main', 'qa-expert'],
      totalTickets: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST start pipeline (one-click from idle → ba_started, kicks off BA agent)
app.post('/api/pipeline/start', async (req, res) => {
  try {
    if (pipelineState.currentStep !== 'idle') {
      return res.status(400).json({ error: 'Pipeline already running (step: ' + pipelineState.currentStep + ')' })
    }
    
    console.log('🚀 Pipeline started by CEO')
    
    // Mark idle complete, ba_started active
    const updatedSteps = pipelineState.steps.map((s, i) => ({
      ...s,
      completed: i < 1, // idle completed
      active: i === 1,  // ba_started active
    }))
    
    pipelineState = {
      currentStep: 'ba_started',
      steps: updatedSteps,
      context: {},
    }
    
    savePipelineState()
    
    // Start BA agent
    try {
      const { startAgentWithLinearIssue } = await import('./agent-mapping-fixed.js')
      startAgentWithLinearIssue('ba-platform', 'INIT', '**Pipeline Started**\n\nThe CEO has approved the first BA ticket and started the pipeline.\nPlease analyze project docs and draft a backlog for Frontend EM and Backend EM review.')
      console.log('✅ BA agent activated')
    } catch (e: any) {
      console.error('❌ Failed to start BA agent:', e.message)
    }
    
    // Broadcast update
    broadcast({ type: 'pipeline_update', data: pipelineState })
    
    console.log('✅ Pipeline started — BA agent activated')
    
    // Kick off auto-advance chain (BA Analyzing for 30s, then auto-advance through all steps)
    setTimeout(async () => {
      try {
        await executePipelineStep('ba_ready', pipelineState)
      } catch (e: any) {
        console.error('❌ Auto-advance from pipeline start failed:', e.message)
      }
    }, 30000)
    res.json({ pipeline: pipelineState })
    
  } catch (error: any) {
    console.error('❌ Pipeline start error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// POST advance a pipeline step
app.post('/api/pipeline/step', async (req, res) => {
  try {
    const { step } = req.body as { step: PipelineStepId }
    
    if (!step) {
      return res.status(400).json({ error: 'Missing step parameter' })
    }
    
    console.log(`🔧 Pipeline step triggered: ${step}`)
    
    // Find the step index
    const stepIndex = pipelineState.steps.findIndex(s => s.id === step)
    if (stepIndex === -1) {
      return res.status(400).json({ error: `Unknown step: ${step}` })
    }
    
    // Mark current step as complete, new step as active
    const updatedSteps = pipelineState.steps.map((s, i) => ({
      ...s,
      completed: i < stepIndex || s.completed,
      active: i === stepIndex,
    }))
    
    pipelineState = {
      currentStep: step,
      steps: updatedSteps,
      context: pipelineState.context || {},
    }
    
    savePipelineState()
    
    // Broadcast pipeline update
    broadcast({
      type: 'pipeline_update',
      data: pipelineState
    })
    
    console.log('✅ Pipeline advanced to: ' + step + ' (' + pipelineState.steps[stepIndex].label + ')')
    
    // Execute real actions for this step
    try {
      await executePipelineStep(step, pipelineState)
    } catch (actionError) {
      console.error('❌ Pipeline step action failed for ' + step + ':', actionError.message)
    }
    
    res.json({ pipeline: pipelineState })
    
  } catch (error) {
    console.error('❌ Pipeline step error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

/** Delays for each pipeline step (in milliseconds). */
const BA_READY_DELAY = 30000
const EM_REVIEW_DELAY = 20000
const CTO_REVIEW_DELAY = 15000
const TICKET_CREATION_DELAY = 15000
const AGENTS_WORK_DELAY = 30000

/** Helper: advance the pipeline state to a specific step. */
function advanceToStep(targetStep: PipelineStepId): PipelineState {
  const targetIndex = pipelineState.steps.findIndex(s => s.id === targetStep)
  if (targetIndex === -1) return pipelineState
  const updatedSteps = pipelineState.steps.map((s, i) => ({
    ...s,
    completed: i < targetIndex,
    active: i === targetIndex,
  }))
  pipelineState = { currentStep: targetStep, steps: updatedSteps, context: pipelineState.context || {} }
  savePipelineState()
  broadcast({ type: 'pipeline_update', data: pipelineState })
  return pipelineState
}

/** Schedule the next pipeline step after a delay. */
function autoAdvancePipeline(nextStep: PipelineStepId, delayMs: number): void {
  console.log('⏱️ Auto-advance to ' + nextStep + ' in ' + (delayMs / 1000) + 's')
  setTimeout(async () => {
    try {
      await executePipelineStep(nextStep, pipelineState)
    } catch (e: any) {
      console.error('❌ Auto-advance failed for ' + nextStep + ':', e.message)
    }
  }, delayMs)
}

/** Execute the real action for a pipeline step. Each step auto-advances to the next. */
async function executePipelineStep(step: PipelineStepId, state: PipelineState): Promise<void> {
  const { startAgentWithLinearIssue } = await import('./agent-mapping-fixed.js')

  switch (step) {
    case 'ba_started':
      console.log('📋 BA Analyzing — auto-chain started')
      advanceToStep('ba_started')
      broadcast({ type: 'activity', data: { id: 'pipeline-' + Date.now(), user: 'System', action: 'BA started analysis', type: 'development', time: 'Just now', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system', details: 'Platform BA agent analyzing docs and drafting backlog', timestamp: new Date().toISOString() }})
      autoAdvancePipeline('ba_ready', BA_READY_DELAY)
      break

    case 'ba_ready':
      console.log('📋 BA Ready — notifying Frontend EM and Backend EM')
      advanceToStep('ba_ready')
      ;(function() {
        const emMsg = '**BA Backlog Ready**\n\nThe Business Analyst has completed their analysis and drafted the backlog.\nPlease review and provide feedback.'
        try { startAgentWithLinearIssue('frontend-em', 'BA-READY', emMsg); console.log('  Notified Frontend EM') } catch (e) { console.error('  Failed to notify Frontend EM:', e.message) }
        try { startAgentWithLinearIssue('backend-em', 'BA-READY', emMsg); console.log('  Notified Backend EM') } catch (e) { console.error('  Failed to notify Backend EM:', e.message) }
      })()
      broadcast({ type: 'activity', data: { id: 'pipeline-' + Date.now(), user: 'System', action: 'BA analysis complete', type: 'development', time: 'Just now', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system', details: 'BA completed backlog. Frontend EM + Backend EM notified.', timestamp: new Date().toISOString() }})
      autoAdvancePipeline('em_reviewing', EM_REVIEW_DELAY)
      break

    case 'em_reviewing':
      console.log('📋 EMs Reviewing')
      advanceToStep('em_reviewing')
      broadcast({ type: 'activity', data: { id: 'pipeline-' + Date.now(), user: 'System', action: 'EMs reviewing backlog', type: 'development', time: 'Just now', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system', details: 'Frontend EM and Backend EM are reviewing the BA backlog', timestamp: new Date().toISOString() }})
      autoAdvancePipeline('em_approved', EM_REVIEW_DELAY)
      break

    case 'em_approved':
      console.log('📋 EMs Approved — notifying CTO')
      advanceToStep('em_approved')
      ;(function() {
        const ctoMsg = '**EMs Approved Backlog**\n\nBoth Frontend EM and Backend EM have approved the backlog.\nPlease verify the pipeline plan.'
        try { startAgentWithLinearIssue('main', 'EM-APPROVED', ctoMsg); console.log('  Notified CTO') } catch (e) { console.error('  Failed to notify CTO:', e.message) }
      })()
      broadcast({ type: 'activity', data: { id: 'pipeline-' + Date.now(), user: 'System', action: 'EMs approved backlog', type: 'development', time: 'Just now', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system', details: 'Both EMs approved. Orange AI (CTO) notified.', timestamp: new Date().toISOString() }})
      autoAdvancePipeline('cto_reviewing', CTO_REVIEW_DELAY)
      break

    case 'cto_reviewing':
      console.log('📋 CTO Review')
      advanceToStep('cto_reviewing')
      broadcast({ type: 'activity', data: { id: 'pipeline-' + Date.now(), user: 'Orange AI', action: 'CTO reviewing pipeline', type: 'development', time: 'Just now', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=main', details: 'Orange AI performing pipeline verification', timestamp: new Date().toISOString() }})
      autoAdvancePipeline('tickets_created', CTO_REVIEW_DELAY)
      break

    case 'tickets_created':
      console.log('📋 Tickets Created')
      advanceToStep('tickets_created')
      broadcast({ type: 'activity', data: { id: 'pipeline-' + Date.now(), user: 'System', action: 'Tickets created in Linear', type: 'development', time: 'Just now', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system', details: 'Backlog tickets created with agent:xxx labels.', timestamp: new Date().toISOString() }})
      autoAdvancePipeline('agents_working', TICKET_CREATION_DELAY)
      break

    case 'agents_working':
      console.log('📋 Agents Working')
      advanceToStep('agents_working')
      broadcast({ type: 'activity', data: { id: 'pipeline-' + Date.now(), user: 'System', action: 'Pipeline agents executing', type: 'development', time: 'Just now', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system', details: 'Multiple agents working in parallel', timestamp: new Date().toISOString() }})
      autoAdvancePipeline('complete', AGENTS_WORK_DELAY)
      break

    case 'complete':
      console.log('📋 Pipeline Complete')
      advanceToStep('complete')
      broadcast({ type: 'activity', data: { id: 'pipeline-' + Date.now(), user: 'System', action: 'Pipeline complete', type: 'development', time: 'Just now', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=system', details: 'All pipeline steps completed successfully', timestamp: new Date().toISOString() }})
      break

    default:
      break
  }
}
app.post('/webhook/linear', async (req, res) => {
  const event = req.body
  console.log('📨 Linear webhook received:', event.type || event.action || 'unknown')
  
  // Process pipeline if the event has issue data
  if (event.data && event.data.id && event.action) {
    try {
      const result = await handleLinearWebhook(event)
      console.log(`📨 Webhook result: ${result.handled ? '✓' : '✗'} ${result.action}`)
      
      // Broadcast to dashboard (even if we didn't process it)
      broadcast({
        type: 'activity',
        data: {
          id: `linear-${Date.now()}`,
          user: 'Linear System',
          action: `Linear issue ${event.action}: ${event.data?.identifier || 'Unknown'}`,
          type: 'development',
          time: 'Just now',
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=linear',
          details: event.data?.title || 'No details'
        }
      })
    } catch (e: any) {
      console.error('❌ Linear webhook handler error:', e.message)
      // Don't fail — Linear expects 200 for delivery confirmation
    }
  }
  
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
  
  // Start GitHub polling (every 60 seconds, initial run after 5s)
  setTimeout(() => {
    console.log('📦 Starting GitHub ticket sync...')
    syncGitHubTickets()
      .then(result => console.log(`📦 Initial GitHub sync: ${result.issues} issues, ${result.prs} PRs`))
      .catch(err => console.error('❌ Initial GitHub sync failed:', err.message))
    
    setInterval(() => {
      syncGitHubTickets()
        .catch(err => console.error('❌ GitHub sync failed:', err.message))
    }, 60000)
  }, 5000)

  // ─── Blocked ticket timeout checker ───
  // Every 30 min, check for tickets blocked > 24h and notify Nimphius
  setInterval(async () => {
    try {
      const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
      if (!LINEAR_API_KEY) return;

      const https = await import('https');
      
      // Query for issues in Blocked state
      const query = JSON.stringify({
        query: `{ issues(first: 50, filter: { state: { name: { eq: "Blocked" } }, team: { key: { eq: "ORA" } } }) { nodes { identifier title state { name } updatedAt labels { nodes { name } } } } }`
      });
      
      const result = await new Promise<any>((resolve, reject) => {
        const req = https.request({
          hostname: 'api.linear.app',
          path: '/graphql',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': LINEAR_API_KEY
          }
        }, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        });
        req.write(query);
        req.end();
      });

      const issues = result?.data?.issues?.nodes || [];
      const now = Date.now();
      const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const issue of issues) {
        const updatedAt = new Date(issue.updatedAt).getTime();
        if (now - updatedAt > STALE_MS) {
          const botToken = '8785351397:AAHVD-ZAAloK-4hRijrs85WEWm15vyv94bk';
          const chatId = '6297967611';
          const msg = `🕐 STALE BLOCKER >24h: ${issue.identifier}: "${issue.title}"\n\nhttps://linear.app/orangedoorhouse/issue/${issue.identifier}`;
          
          try {
            const postData = JSON.stringify({ chat_id: chatId, text: msg });
            const req = https.request({
              hostname: 'api.telegram.org',
              path: `/bot${botToken}/sendMessage`,
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            req.write(postData);
            req.end();
          } catch (e: any) {
            console.warn(`Failed to notify stale blocker ${issue.identifier}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      console.warn(`Stale blocker check failed: ${e.message}`);
    }
  }, 30 * 60 * 1000); // every 30 minutes

  // ─── Pipeline ticket watcher ───
  // Checks every 60s for Todo tickets with agent labels but no active session.
  // Railway creates child tickets on webhook but cannot spawn agents locally.
  // This watcher picks up those orphaned tickets and activates the matching agent.
  async function checkPipelineTickets() {
    try {
      const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
      if (!LINEAR_API_KEY) return;

      const https = await import('https');

      // Query for Todo tickets with agent: labels
      const query = JSON.stringify({
        query: `{ issues(first: 5, filter: { team: { key: { eq: "ORA" } }, state: { name: { eq: "Todo" } } }) { nodes { id identifier title labels { nodes { name } } } } }`
      });

      const result = await new Promise<any>((resolve, reject) => {
        const req = https.request({
          hostname: 'api.linear.app',
          path: '/graphql',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': LINEAR_API_KEY
          }
        }, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        });
        req.write(query);
        req.end();
      });

      const issues = result?.data?.issues?.nodes || [];
      if (issues.length === 0) return;

      for (const issue of issues) {
        const agentLabels = (issue.labels?.nodes || [])
          .filter((l: any) => l.name.startsWith('agent:'))
          .map((l: any) => l.name.replace('agent:', ''));

        for (const agentId of agentLabels) {
          if (agentId === 'ba-platform') continue; // BA is manual
          try {
            const result = startAgentWithLinearIssue(agentId, {
              identifier: issue.identifier,
              title: issue.title,
              id: issue.id
            });
            if (result.success) {
              console.log(`🐉 Pipeline watcher: activated ${agentId} on ${issue.identifier}`);
            }
          } catch (e: any) {
            console.warn(`Pipeline watcher: failed to activate ${agentId} on ${issue.identifier}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      console.warn(`Pipeline watcher check failed: ${e.message}`);
    }
  }

  // Run pipeline watcher every 60 seconds, first check after 10s
  setTimeout(() => checkPipelineTickets(), 10_000);
  setInterval(() => checkPipelineTickets(), 60_000);
})