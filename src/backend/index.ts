import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'

const app = express()
const PORT = 3003

// WebSocket for real-time updates
const wss = new WebSocketServer({ port: 3004 })
const clients = new Set<WebSocket>()

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log('📡 WebSocket client connected')
  
  ws.on('close', () => {
    clients.delete(ws)
    console.log('📡 WebSocket client disconnected')
  })
})

// Broadcast to all WebSocket clients
function broadcast(data: any) {
  const message = JSON.stringify(data)
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Get dashboard data
app.get('/api/dashboard', (req, res) => {
  res.json({
    team: [
      {
        id: 1,
        name: 'Video Generation Assistant',
        role: 'Video Generation Engineering',
        status: 'active',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=video-gen',
        joinDate: '2026-04-19',
      },
      {
        id: 2,
        name: 'Design System Platform Engineer',
        role: 'Design System Architecture & Platform',
        status: 'onboarding',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=design-system',
        onboardingProgress: 30,
        onboardingDays: 'Day 2 of 7',
        joinDate: '2026-04-20',
      },
      {
        id: 3,
        name: 'Documentation Specialist',
        role: 'Engineering Documentation & Quality',
        status: 'onboarding',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=documentation',
        onboardingProgress: 25,
        onboardingDays: 'Day 2 of 7',
        joinDate: '2026-04-20',
      },
      {
        id: 4,
        name: 'Head Engineer',
        role: 'Engineering Leadership',
        status: 'active',
        avatar: 'https://github.com/nimphius.png',
        joinDate: '2026-04-19',
      },
    ],
    activity: [
      // Linear integration activities (mock - will be replaced by real webhooks)
      {
        id: Date.now() - 3600000,
        user: 'Design System Platform Engineer',
        action: 'Created Linear issue: ORA-1 - Set up design system repository',
        type: 'development',
        time: '1 hour ago',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=design-system',
        details: 'New issue for design system foundation',
        metadata: {
          source: 'linear',
          issueId: 'mock-1',
          identifier: 'ORA-1',
          team: 'DSN',
        },
      },
      {
        id: Date.now() - 7200000,
        user: 'Documentation Specialist',
        action: 'Created Linear issue: ORA-2 - Implement engineering workflow',
        type: 'documentation',
        time: '2 hours ago',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=documentation',
        details: 'Documentation for engineering standards',
        metadata: {
          source: 'linear',
          issueId: 'mock-2',
          identifier: 'ORA-2',
          team: 'DOC',
        },
      },
      {
        id: Date.now() - 10800000,
        user: 'Head Engineer',
        action: 'Created Linear issue: ORA-3 - Create HR Dashboard ↔ Linear integration',
        type: 'development',
        time: '3 hours ago',
        avatar: 'https://github.com/nimphius.png',
        details: 'Integration between HR Dashboard and Linear',
        metadata: {
          source: 'linear',
          issueId: 'mock-3',
          identifier: 'ORA-3',
          team: 'ENG',
        },
      },
      
      // Original activities
      {
        id: Date.now() - 600000,
        user: 'Head Engineer',
        action: 'Created engineering workflow documentation',
        type: 'documentation',
        time: 'Just now',
        avatar: 'https://github.com/nimphius.png',
        details: 'Defined PR review process, QA integration, and development standards',
      },
      {
        id: Date.now() - 3600000,
        user: 'Design System Platform Engineer',
        action: 'Started storyhouse-design-system repository setup',
        type: 'development',
        time: '1 hour ago',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=design-system',
        details: 'Initializing monorepo with TypeScript, Storybook, and Astro docs',
      },
      {
        id: Date.now() - 7200000,
        user: 'Documentation Specialist',
        action: 'Reviewing engineering workflow documentation',
        type: 'documentation',
        time: '2 hours ago',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=documentation',
        details: 'Ensuring all standards are documented and maintainable',
      },
      {
        id: Date.now() - 10800000,
        user: 'Video Generation Assistant',
        action: 'Testing VEO3 API integration',
        type: 'testing',
        time: '3 hours ago',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=video-gen',
        details: 'Successfully generated 5 test video scenes',
      },
    ],
    approvals: [
      {
        id: 1,
        type: 'video_generation',
        title: 'Test Video Generation Request',
        description: 'Scene #1 - Sunset landscape for demo',
        requester: 'Design System Engineer',
        cost: 0.75,
        status: 'pending',
        time: '10 minutes ago',
        priority: 'medium',
      },
    ],
    metrics: {
      teamSize: 4,
      activeMembers: 2,
      onboardingMembers: 2,
      approvalRate: 0,
      avgResponseTime: '4.2 hours',
    },
  })
})

// Approve an item
app.post('/api/approve/:id', (req, res) => {
  const { id } = req.params
  console.log(`✅ Approval requested for item ${id}`)
  
  // Broadcast approval event
  broadcast({
    type: 'approval',
    action: 'approved',
    id,
    timestamp: new Date().toISOString(),
  })
  
  res.json({ success: true, message: `Item ${id} approved` })
})

// Deny an item
app.post('/api/deny/:id', (req, res) => {
  const { id } = req.params
  console.log(`❌ Denial requested for item ${id}`)
  
  // Broadcast denial event
  broadcast({
    type: 'approval',
    action: 'denied',
    id,
    timestamp: new Date().toISOString(),
  })
  
  res.json({ success: true, message: `Item ${id} denied` })
})

// Orange HR webhook endpoint
app.post('/webhook/orange-hr', (req, res) => {
  const event = req.body
  console.log('📨 Orange HR webhook received:', event)
  
  // Create activity from webhook
  const activity = {
    id: Date.now(),
    user: 'Orange HR Bot',
    action: `New ${event.type}: ${event.title || 'Unknown'}`,
    type: 'hr',
    time: 'Just now',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=hr-bot',
    details: event.description || 'No details provided',
  }
  
  // Broadcast to WebSocket clients
  broadcast({
    type: 'activity',
    data: activity,
  })
  
  res.json({ success: true, message: 'Webhook processed' })
})

// Linear webhook endpoint (mock for now)
app.post('/webhook/linear', (req, res) => {
  const event = req.body
  console.log('📨 Linear webhook received (mock):', event.type || 'unknown')
  
  // In production, this would handle real Linear webhooks
  // For now, just acknowledge
  res.json({ success: true, message: 'Linear webhook received (mock)' })
})

// Get real Linear issues
app.get('/api/linear/issues', async (req, res) => {
  try {
    // Fetch from Linear API
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.LINEAR_API_KEY || '',
      },
      body: JSON.stringify({
        query: `
          query {
            issues(first: 10) {
              nodes {
                id
                identifier
                title
                description
                state {
                  name
                }
                priority
                assignee {
                  name
                  displayName
                  avatarUrl
                }
                team {
                  key
                  name
                }
                createdAt
                updatedAt
              }
            }
          }
        `,
      }),
    })

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.errors) {
      throw new Error(`Linear GraphQL errors: ${JSON.stringify(data.errors)}`)
    }

    const issues = data.data.issues.nodes.map((issue: any) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || '',
      status: issue.state.name,
      priority: issue.priority,
      assignee: issue.assignee ? {
        name: issue.assignee.displayName || issue.assignee.name,
        avatar: issue.assignee.avatarUrl,
      } : null,
      team: issue.team.key,
      teamName: issue.team.name,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    }))

    // Filter to show only our foundational issues (ORA-5 through ORA-10)
    const foundationalIssues = issues.filter((issue: any) => {
      const issueNum = parseInt(issue.identifier.replace('ORA-', ''))
      return issueNum >= 5 && issueNum <= 10
    })

    res.json({
      success: true,
      issues: foundationalIssues,
      total: issues.length,
    })

  } catch (error: any) {
    console.error('❌ Error fetching Linear issues:', error.message)
    console.error('API Key present:', !!process.env.LINEAR_API_KEY)
    
    // Fallback to mock data if API fails
    res.json({
      success: false,
      message: `Using mock data - ${error.message}`,
      issues: [
        {
          id: 'mock-1',
          identifier: 'ORA-6',
          title: 'Set up design system repository',
          status: 'Todo',
          assignee: {
            name: 'Design System Platform Engineer',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=design-system',
          },
          team: 'ORA',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'mock-2',
          identifier: 'ORA-7',
          title: 'Implement engineering workflow',
          status: 'Todo',
          assignee: {
            name: 'Documentation Specialist',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=documentation',
          },
          team: 'ORA',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'mock-3',
          identifier: 'ORA-8',
          title: 'Create HR Dashboard ↔ Linear integration',
          status: 'Todo',
          assignee: {
            name: 'Head Engineer',
            avatar: 'https://github.com/nimphius.png',
          },
          team: 'ORA',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'mock-4',
          identifier: 'ORA-9',
          title: 'Hire Business Analyst',
          status: 'Todo',
          assignee: {
            name: 'Head Engineer',
            avatar: 'https://github.com/nimphius.png',
          },
          team: 'ORA',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'mock-5',
          identifier: 'ORA-10',
          title: 'Set up QA testing framework',
          status: 'Todo',
          assignee: null,
          team: 'ORA',
          createdAt: new Date().toISOString(),
        },
      ],
    })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 HR Dashboard API running on http://localhost:${PORT}`)
  console.log(`📡 WebSocket server running on ws://localhost:3004`)
  console.log(`🔗 Orange HR webhook: POST http://localhost:${PORT}/webhook/orange-hr`)
  console.log(`🔗 Linear webhook: POST http://localhost:${PORT}/webhook/linear`)
})