#!/usr/bin/env node

/**
 * Simple HTTPS server for Linear webhook testing
 * Uses self-signed certificate for local HTTPS
 */

import 'dotenv/config';
import https from 'https';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';

// Read SSL certificates
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
};

const app = (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Linear-Signature');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }
  
  // Linear webhook endpoint
  if (req.url === '/webhook/linear' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        console.log('📨 HTTPS Linear webhook received:', event.type || 'unknown');
        
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
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Webhook processed' }));
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }
  
  // Default 404
  res.writeHead(404);
  res.end('Not Found');
};

// Create HTTPS server
const server = https.createServer(options, app);

// WebSocket for real-time updates
const wss = new WebSocketServer({ server });
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

// Start server
const PORT = 3443;
server.listen(PORT, () => {
  console.log(`🚀 HTTPS server running on https://localhost:${PORT}`);
  console.log(`🔗 Linear webhook: POST https://localhost:${PORT}/webhook/linear`);
  console.log(`🔗 Health check: GET https://localhost:${PORT}/health`);
  console.log('\n⚠️  IMPORTANT: This uses a self-signed certificate.');
  console.log('   Linear may reject it. For production, use:');
  console.log('   1. Render.com (waiting for deployment)');
  console.log('   2. Cloudflare Tunnel (needs authentication)');
  console.log('   3. Railway (needs authentication)');
});