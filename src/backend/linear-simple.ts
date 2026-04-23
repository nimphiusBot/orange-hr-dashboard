// Simple Linear integration - returns error when API fails, no mock data
import 'dotenv/config'

const LINEAR_API_KEY = process.env.LINEAR_API_KEY
const LINEAR_API_URL = 'https://api.linear.app/graphql'

/**
 * Fetch a single issue's details (specifically assignee info) from Linear
 * Fail-fast: throws on error, no fallback
 */
export async function getIssueDetails(issueId: string): Promise<{
  id: string;
  identifier: string;
  assignee: { displayName: string } | null;
}> {
  if (!LINEAR_API_KEY) {
    throw new Error('LINEAR_API_KEY not configured in .env file')
  }
  
  const query = `query { issue(id: "${issueId}") { id identifier assignee { displayName } } }`
  
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query })
  })
  
  if (!response.ok) {
    throw new Error(`Linear API responded with ${response.status}: ${response.statusText}`)
  }
  
  const data = await response.json()
  
  if (data.errors) {
    throw new Error(`Linear API error: ${data.errors[0].message}`)
  }
  
  if (!data.data?.issue) {
    throw new Error(`Issue ${issueId} not found in Linear`)
  }
  
  return data.data.issue
}

/**
 * Set issue assignee by display name.
 * Looks up the user in Linear, sets assigneeId on issue.
 * Fail-fast: throws on error, no fallback.
 */
export async function setIssueAssignee(issueId: string, assigneeName: string): Promise<void> {
  if (!LINEAR_API_KEY) {
    throw new Error('LINEAR_API_KEY not configured in .env file')
  }
  
  // First: find the user by display name
  const userQuery = `
  query {
    users(first: 50) {
      nodes {
        id
        displayName
        email
      }
    }
  }
  `
  
  const userResponse = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query: userQuery })
  })
  
  if (!userResponse.ok) {
    throw new Error(`Linear API users query responded with ${userResponse.status}`)
  }
  
  const userData = await userResponse.json()
  
  if (userData.errors) {
    throw new Error(`Linear API error fetching users: ${userData.errors[0].message}`)
  }
  
  const users = userData.data?.users?.nodes || []
  
  // Try exact match first, then case-insensitive
  const user = users.find((u: any) => u.displayName === assigneeName)
    || users.find((u: any) => u.displayName.toLowerCase() === assigneeName.toLowerCase())
  
  if (!user) {
    throw new Error(`User "${assigneeName}" not found in Linear workspace. Available users: ${users.map((u: any) => u.displayName).join(', ')}`)
  }
  
  // Second: set the assignee on the issue
  const assignMutation = `
  mutation {
    issueUpdate(
      id: "${issueId}",
      input: {
        assigneeId: "${user.id}"
      }
    ) {
      success
      issue {
        id
        identifier
        assignee {
          displayName
        }
      }
    }
  }
  `
  
  const assignResponse = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query: assignMutation })
  })
  
  if (!assignResponse.ok) {
    throw new Error(`Linear API assign mutation responded with ${assignResponse.status}`)
  }
  
  const assignData = await assignResponse.json()
  
  if (assignData.errors) {
    throw new Error(`Linear API error assigning user: ${assignData.errors[0].message}`)
  }
  
  if (!assignData.data?.issueUpdate?.success) {
    throw new Error('Linear API failed to set assignee on issue')
  }
  
  console.log(`✅ Assigned ${assigneeName} to ${assignData.data.issueUpdate.issue.identifier}`)
}

export async function approveLinearIssue(issueId: string, approvedBy: string, comments?: string) {
  if (!LINEAR_API_KEY) {
    return {
      success: false,
      error: 'LINEAR_API_KEY not configured in .env file'
    }
  }
  
  try {
    // First fetch the workflow state ID for "In Progress"
    const teamQuery = `{ teams(first: 1) { nodes { id states(first: 20) { nodes { id name type } } } } }`
    
    const teamResponse = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY
      },
      body: JSON.stringify({ query: teamQuery })
    })
    
    if (!teamResponse.ok) {
      throw new Error(`Linear API responded with ${teamResponse.status}: ${teamResponse.statusText}`)
    }
    
    const teamData = await teamResponse.json()
    
    if (teamData.errors) {
      throw new Error(`Linear API error: ${teamData.errors[0].message}`)
    }
    
    // Find the "In Progress" state
    const states = teamData.data.teams.nodes[0]?.states?.nodes || []
    const inProgressState = states.find((s: any) => s.type === 'started' || s.name.toLowerCase() === 'in progress')
    
    if (!inProgressState) {
      throw new Error('Could not find "In Progress" workflow state in Linear')
    }
    
    // Transition the issue to In Progress
    const transitionMutation = `
      mutation {
        issueUpdate(
          id: "${issueId}",
          input: {
            stateId: "${inProgressState.id}"
          }
        ) {
          success
          issue {
            id
            identifier
            state {
              name
            }
          }
        }
      }
    `
    
    const transitionResponse = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY
      },
      body: JSON.stringify({ query: transitionMutation })
    })
    
    if (!transitionResponse.ok) {
      throw new Error(`Linear API responded with ${transitionResponse.status}: ${transitionResponse.statusText}`)
    }
    
    const transitionData = await transitionResponse.json()
    
    if (transitionData.errors) {
      throw new Error(`Linear API error: ${transitionData.errors[0].message}`)
    }
    
    if (!transitionData.data?.issueUpdate?.success) {
      throw new Error('Linear API failed to transition issue state')
    }
    
    console.log(`✅ Linear issue ${transitionData.data.issueUpdate.issue.identifier} transitioned to ${transitionData.data.issueUpdate.issue.state.name}`)
    
    return {
      success: true,
      data: {
        id: issueId,
        identifier: transitionData.data.issueUpdate.issue.identifier,
        newState: transitionData.data.issueUpdate.issue.state.name,
        approvedBy,
        approvedAt: new Date().toISOString(),
        comments
      }
    }
    
  } catch (error: any) {
    console.error('❌ Linear approval API call failed:', error.message)
    return {
      success: false,
      error: error.message,
      help: 'Linear API call failed. Check your API key and permissions.'
    }
  }
}

export async function getLinearApprovalQueue(showAll: boolean) {
  if (!LINEAR_API_KEY) {
    throw new Error('LINEAR_API_KEY not configured in .env file')
  }
  
  try {
    // Simple query to test API connection
    const query = showAll 
      ? `query { issues(first: 10, filter: { state: { name: { nin: ["Done", "Canceled"] } } }) { nodes { id identifier title priority estimate assignee { displayName } creator { displayName } team { key name } } } }`
      : `query { issues(first: 10, filter: { priority: { lte: 1 }, state: { name: { nin: ["Done", "Canceled"] } } }) { nodes { id identifier title priority estimate assignee { displayName } creator { displayName } team { key name } } } }`
    
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY
      },
      body: JSON.stringify({ query })
    })
    
    if (!response.ok) {
      throw new Error(`Linear API responded with ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (data.errors) {
      throw new Error(`Linear API error: ${data.errors[0].message}`)
    }
    
    const issues = data.data.issues.nodes.map((issue: any) => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      priority: issue.priority,
      estimate: issue.estimate,
      priorityLabel: getPriorityLabel(issue.priority),
      size: getSizeFromEstimate(issue.estimate),
      assignee: issue.assignee?.displayName || null,
      creator: issue.creator?.displayName || null,
      team: issue.team?.key || null,
      requiresNimphiusApproval: issue.priority <= 1
    }))
    
    return {
      success: true,
      data: issues,
      count: issues.length,
      source: 'linear-api'
    }
    
  } catch (error: any) {
    // Return error instead of mock data
    return {
      success: false,
      error: error.message,
      help: 'To fix: 1. Go to Linear → Settings → API, 2. Generate new API key, 3. Update .env file, 4. Restart dashboard',
      count: 0,
      data: []
    }
  }
}

function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 0: return 'Urgent'
    case 1: return 'High'
    case 2: return 'Medium'
    case 3: return 'Low'
    case 4: return 'None'
    default: return 'Medium'
  }
}

function getSizeFromEstimate(estimate: number | null): string {
  if (!estimate) return 'Small'
  if (estimate <= 2) return 'Small'
  if (estimate <= 5) return 'Medium'
  return 'Large'
}
/**
 * Issue label name prefix for agent mapping.
 * Labels follow format: "agent:<agentId>" e.g. "agent:design-system-engineer"
 */
const AGENT_LABEL_PREFIX = 'agent:'

/**
 * Get or create an agent label in the Linear workspace.
 * Labels are shared across the workspace — we create them once.
 */
async function ensureAgentLabel(agentLabel: string): Promise<string> {
  // First try to find existing label
  const searchQuery = `
    query {
      issueLabels(first: 50) {
        nodes {
          id
          name
        }
      }
    }
  `
  const searchResponse = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query: searchQuery })
  })

  if (!searchResponse.ok) {
    throw new Error(`Linear API responded with ${searchResponse.status}`)
  }

  const searchData = await searchResponse.json()

  if (searchData.errors) {
    throw new Error(`Linear API error: ${searchData.errors[0].message}`)
  }

  const existing = searchData.data?.issueLabels?.nodes?.find(
    (l: any) => l.name === agentLabel
  )

  if (existing) return existing.id

  // Create the label
  const createMutation = `
    mutation {
      issueLabelCreate(input: {
        name: "${agentLabel}"
        color: "#f97316"
      }) {
        success
        issueLabel {
          id
          name
        }
      }
    }
  `

  const createResponse = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query: createMutation })
  })

  if (!createResponse.ok) {
    throw new Error(`Linear API responded with ${createResponse.status}`)
  }

  const createData = await createResponse.json()

  if (createData.errors) {
    throw new Error(`Linear API error creating label: ${createData.errors[0].message}`)
  }

  if (!createData.data?.issueLabelCreate?.success) {
    throw new Error('Linear API failed to create agent label')
  }

  console.log(`🏷️  Created agent label: ${agentLabel}`)
  return createData.data.issueLabelCreate.issueLabel.id
}

/**
 * Attach an agent label to a Linear issue after approval.
 * This creates the bridge between Linear issues and dashboard agents.
 * Fail-fast: throws on error, no fallback.
 */
export async function attachAgentLabel(issueId: string, agentId: string): Promise<void> {
  if (!LINEAR_API_KEY) {
    throw new Error('LINEAR_API_KEY not configured in .env file')
  }

  const agentLabel = `${AGENT_LABEL_PREFIX}${agentId}`
  const labelId = await ensureAgentLabel(agentLabel)

  // Get existing labels on the issue
  const issueQuery = `
    query {
      issue(id: "${issueId}") {
        id
        labels {
          nodes {
            id
          }
        }
      }
    }
  `

  const issueResponse = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query: issueQuery })
  })

  if (!issueResponse.ok) {
    throw new Error(`Linear API responded with ${issueResponse.status}`)
  }

  const issueData = await issueResponse.json()

  if (issueData.errors) {
    throw new Error(`Linear API error: ${issueData.errors[0].message}`)
  }

  const existingLabelIds = issueData.data?.issue?.labels?.nodes?.map((l: any) => l.id) || []

  // If agent label already attached, nothing to do
  if (existingLabelIds.includes(labelId)) return

  // Append the agent label
  const allLabelIds = [...existingLabelIds, labelId]

  const mutation = `
    mutation {
      issueUpdate(
        id: "${issueId}",
        input: {
          labelIds: [${allLabelIds.map(id => `"${id}"`).join(',')}]
        }
      ) {
        success
        issue {
          id
          identifier
          labels {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  `

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query: mutation })
  })

  if (!response.ok) {
    throw new Error(`Linear API responded with ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(`Linear API error: ${data.errors[0].message}`)
  }

  if (!data.data?.issueUpdate?.success) {
    throw new Error('Linear API failed to attach agent label')
  }

  console.log(`🏷️  Attached label "${agentLabel}" to ${data.data.issueUpdate.issue.identifier}`)
}

/**
 * Result from Linear for the dashboard's "active issues" query.
 */
export interface ActiveIssue {
  id: string
  identifier: string
  title: string
  priority: number
  priorityLabel: string
  estimate: number | null
  state: string
  stateType: string
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
  agentId: string | null  // extracted from agent:xxx label
  teamKey: string | null
}

/**
 * Fetch all active (non-completed) issues and extract agent mappings from labels.
 * Returns issues enriched with their assigned agentId (from agent:xxx labels).
 * Fail-fast: throws on error, no mock data.
 */
export async function getActiveIssuesWithAgents(): Promise<ActiveIssue[]> {
  if (!LINEAR_API_KEY) {
    throw new Error('LINEAR_API_KEY not configured in .env file')
  }

  const query = `
    query {
      issues(
        first: 50,
        filter: {
          state: { type: { nin: ["completed", "canceled"] } }
        }
      ) {
        nodes {
          id
          identifier
          title
          priority
          estimate
          createdAt
          updatedAt
          startedAt
          completedAt
          state {
            id
            name
            type
          }
          team {
            id
            name
            key
          }
          labels {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  `

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query })
  })

  if (!response.ok) {
    throw new Error(`Linear API responded with ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(`Linear API error: ${data.errors[0].message}`)
  }

  const issues = data.data?.issues?.nodes || []

  return issues.map((issue: any) => {
    // Extract agentId from labels matching "agent:"
    const agentLabel = (issue.labels?.nodes || []).find(
      (l: any) => l.name.startsWith(AGENT_LABEL_PREFIX)
    )
    const agentId = agentLabel ? agentLabel.name.slice(AGENT_LABEL_PREFIX.length) : null

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      priority: issue.priority ?? 4,
      priorityLabel: getPriorityLabel(issue.priority ?? 4),
      estimate: issue.estimate ?? null,
      state: issue.state?.name || 'Unknown',
      stateType: issue.state?.type || 'unstarted',
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      startedAt: issue.startedAt || null,
      completedAt: issue.completedAt || null,
      agentId,
      teamKey: issue.team?.key || null
    }
  })
}

/**
 * Update a Linear issue's description
 * Fail-fast: throws on error, no fallback
 */
export async function updateIssueDescription(issueId: string, description: string): Promise<{ success: boolean }> {
  if (!LINEAR_API_KEY) {
    throw new Error('LINEAR_API_KEY not configured in .env file')
  }
  
  const mutation = `
    mutation {
      issueUpdate(
        id: "${issueId}",
        input: {
          description: ${JSON.stringify(description)}
        }
      ) {
        success
        issue {
          id
          identifier
        }
      }
    }
  `
  
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY
    },
    body: JSON.stringify({ query: mutation })
  })
  
  if (!response.ok) {
    throw new Error(`Linear API responded with ${response.status}: ${response.statusText}`)
  }
  
  const data = await response.json()
  
  if (data.errors) {
    throw new Error(`Linear API error: ${data.errors[0].message}`)
  }
  
  if (!data.data?.issueUpdate?.success) {
    throw new Error('Linear API failed to update issue description')
  }
  
  return { success: true }
}
