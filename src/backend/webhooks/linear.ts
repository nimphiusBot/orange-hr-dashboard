import { Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import { formatLinearIssueForDashboard } from '../linear-client';

// WebSocket server for real-time updates
let wss: WebSocketServer | null = null;

export function setWebSocketServer(server: WebSocketServer) {
  wss = server;
}

// Linear webhook event types
interface LinearWebhookEvent {
  action: 'create' | 'update' | 'remove';
  type: 'Issue' | 'Comment' | 'Project' | 'Cycle' | 'Label';
  data: any;
  createdAt: string;
  url: string;
  updatedFrom?: any;
}

// Map Linear issue state to HR Dashboard activity type
function getActivityTypeFromIssue(issue: any): string {
  const state = issue.state?.name?.toLowerCase() || '';
  
  if (state.includes('backlog')) return 'planning';
  if (state.includes('todo')) return 'assigned';
  if (state.includes('progress')) return 'development';
  if (state.includes('review')) return 'review';
  if (state.includes('qa')) return 'testing';
  if (state.includes('done')) return 'completed';
  
  return 'development';
}

// Create HR Dashboard activity from Linear issue
function createActivityFromLinearIssue(event: LinearWebhookEvent, issue: any) {
  const action = event.action;
  const issueIdentifier = issue.identifier || 'Unknown';
  const issueTitle = issue.title || 'Untitled issue';
  const assignee = issue.assignee;
  
  let actionText = '';
  let details = '';
  
  switch (action) {
    case 'create':
      actionText = `Created Linear issue: ${issueIdentifier} - ${issueTitle}`;
      details = `New issue added to ${issue.team?.name || 'team'}`;
      break;
    case 'update':
      if (event.updatedFrom?.stateId && issue.state) {
        const oldState = event.updatedFrom.stateId;
        const newState = issue.state.name;
        actionText = `Updated Linear issue ${issueIdentifier}: ${oldState} → ${newState}`;
        details = `Issue: ${issueTitle}`;
      } else if (event.updatedFrom?.assigneeId && assignee) {
        actionText = `Assigned Linear issue ${issueIdentifier} to ${assignee.displayName || assignee.name}`;
        details = `Issue: ${issueTitle}`;
      } else {
        actionText = `Updated Linear issue ${issueIdentifier}`;
        details = `Issue: ${issueTitle}`;
      }
      break;
    case 'remove':
      actionText = `Deleted Linear issue: ${issueIdentifier}`;
      details = `Issue: ${issueTitle}`;
      break;
  }
  
  return {
    id: Date.now(),
    user: assignee ? assignee.displayName || assignee.name : 'System',
    action: actionText,
    type: getActivityTypeFromIssue(issue),
    time: 'Just now',
    avatar: assignee?.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=linear',
    details: details,
    metadata: {
      source: 'linear',
      issueId: issue.id,
      identifier: issueIdentifier,
      team: issue.team?.name,
    },
  };
}

// Broadcast activity to all WebSocket clients
function broadcastActivity(activity: any) {
  if (!wss) return;
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify({
        type: 'activity',
        data: activity,
      }));
    }
  });
}

// Linear webhook handler
export async function handleLinearWebhook(req: Request, res: Response) {
  try {
    // Verify webhook signature (if secret is configured)
    const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['linear-signature'] as string;
      if (!signature) {
        console.warn('⚠️ Linear webhook missing signature');
        return res.status(401).json({ error: 'Missing signature' });
      }
      
      // In production, verify the signature here
      // For now, we'll trust it in development
    }
    
    const event: LinearWebhookEvent = req.body;
    
    console.log(`📨 Linear webhook received: ${event.type}.${event.action}`);
    
    // Handle different event types
    switch (event.type) {
      case 'Issue':
        await handleIssueEvent(event);
        break;
      case 'Comment':
        // Handle comments if needed
        break;
      default:
        console.log(`ℹ️ Unhandled Linear event type: ${event.type}`);
    }
    
    // Send success response
    res.json({ success: true, message: 'Webhook processed' });
    
  } catch (error) {
    console.error('❌ Linear webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Handle Linear issue events
async function handleIssueEvent(event: LinearWebhookEvent) {
  const issue = event.data;
  
  // Create activity for HR Dashboard
  const activity = createActivityFromLinearIssue(event, issue);
  
  // Broadcast to WebSocket clients
  broadcastActivity(activity);
  
  // Log for debugging
  console.log(`📊 Linear activity: ${activity.action}`);
  
  // Update team member status if issue is assigned
  if (issue.assignee && (event.action === 'create' || event.action === 'update')) {
    const assigneeName = issue.assignee.displayName || issue.assignee.name;
    const issueTitle = issue.title || 'Untitled issue';
    const issueState = issue.state?.name || 'Unknown';
    
    console.log(`👤 ${assigneeName} is working on: ${issueTitle} (${issueState})`);
    
    // In a real system, we would update the team member's current task
    // in the database here
  }
}

// Mock data for development (when Linear API is not configured)
export function getMockLinearActivities() {
  const now = Date.now();
  return [
    {
      id: now - 3600000,
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
      id: now - 7200000,
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
      id: now - 10800000,
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
  ];
}