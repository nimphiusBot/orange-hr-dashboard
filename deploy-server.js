#!/usr/bin/env node

/**
 * Simple deployable server for Linear webhooks
 * Can be deployed to Render.com, Railway, Fly.io, etc.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const PORT = process.env.PORT || 3003;

// WebSocket for real-time updates
const wss = new WebSocketServer({ port: 3004 });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('📡 WebSocket client connected');
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('📡 WebSocket client disconnected');
  });
});

// Broadcast to all WebSocket clients
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Linear webhook endpoint
app.post('/webhook/linear', (req, res) => {
  const event = req.body;
  console.log('📨 Linear webhook received:', event.type || 'unknown');
  
  // Verify webhook signature if secret is set
  const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers['linear-signature'];
    if (!signature) {
      console.warn('⚠️ Linear webhook missing signature');
      return res.status(401).json({ error: 'Missing signature' });
    }
    // In production, verify signature here
  }
  
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
  };
  
  // Broadcast to WebSocket clients
  broadcast({
    type: 'activity',
    data: activity,
  });
  
  res.json({ success: true, message: 'Webhook processed' });
});

// Get Linear issues (proxy to Linear API)
app.get('/api/linear/issues', async (req, res) => {
  const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
  
  if (!LINEAR_API_KEY) {
    return res.json({
      success: false,
      message: 'Linear API key not configured',
      issues: [],
    });
  }
  
  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
      },
      body: JSON.stringify({
        query: `
          query {
            issues(first: 10) {
              nodes {
                id
                identifier
                title
                state { name }
                team { key name }
                createdAt
              }
            }
          }
        `,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Linear API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    
    const issues = data.data.issues.nodes.map(issue => ({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      status: issue.state.name,
      team: issue.team.key,
      teamName: issue.team.name,
      createdAt: issue.createdAt,
    }));
    
    res.json({
      success: true,
      issues: issues.filter(issue => {
        // Filter to show only our issues (ORA-5 and above)
        const issueNum = parseInt(issue.identifier.replace('ORA-', ''));
        return issueNum >= 5;
      }),
    });
    
  } catch (error) {
    console.error('Error fetching Linear issues:', error.message);
    res.json({
      success: false,
      message: `Error: ${error.message}`,
      issues: [],
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Deployable server running on port ${PORT}`);
  console.log(`📡 WebSocket server on port 3004`);
  console.log(`🔗 Linear webhook: POST http://localhost:${PORT}/webhook/linear`);
  console.log(`🔗 Health check: GET http://localhost:${PORT}/health`);
  console.log(`🔗 Linear issues: GET http://localhost:${PORT}/api/linear/issues`);
  console.log('\n📋 Environment check:');
  console.log(`   LINEAR_API_KEY: ${process.env.LINEAR_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   LINEAR_WEBHOOK_SECRET: ${process.env.LINEAR_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing (optional)'}`);
});