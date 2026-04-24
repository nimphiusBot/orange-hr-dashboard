#!/usr/bin/env node

/**
 * Deployable server for HR Dashboard backend.
 * Railway entry point — full pipeline auto-advance included.
 *
 * CJS-compatible (no "type": "module" needed in package.json).
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const { WebSocketServer, WebSocket } = require('ws');

// ─── Constants ───
const LINEAR_API_KEY = process.env.LINEAR_API_KEY || '';
const LINEAR_API_URL = 'https://api.linear.app/graphql';
const TELEGRAM_BOT_TOKEN = '8785351397:AAHVD-ZAAloK-4hRijrs85WEWm15vyv94bk';
const TELEGRAM_CHAT_ID = '6297967611';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// ─── Agent pipeline configuration ───
const PIPELINE = {
  'ba-platform': ['frontend-em', 'backend-em'],
  'frontend-em': ['design-system-engineer'],
  'design-system-engineer': ['main'],
  'backend-em': ['main'],
  'main': ['qa-expert'],
  'qa-expert': ['documentation-specialist'],
  'documentation-specialist': [],
};

const AGENT_DISPLAY_NAMES = {
  'ba-platform': 'BA',
  'frontend-em': 'Frontend EM',
  'backend-em': 'Backend EM',
  'design-system-engineer': 'DS Engineer',
  'main': 'CTO',
  'qa-expert': 'QA Expert',
  'documentation-specialist': 'Doc Specialist',
};

function getNextInPipeline(agentId) {
  return PIPELINE[agentId] || [];
}

function getAgentDisplayName(agentId) {
  return AGENT_DISPLAY_NAMES[agentId] || agentId;
}

function extractAgentFromLabels(labels) {
  if (!labels) return null;
  const agentLabel = labels.find(l => l.name && l.name.startsWith('agent:'));
  if (!agentLabel) return null;
  return agentLabel.name.slice('agent:'.length);
}

// ─── Linear API helpers ───
async function graphql(query) {
  try {
    var res = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': LINEAR_API_KEY },
      body: JSON.stringify({ query }),
    });
    return await res.json();
  } catch (e) {
    return { error: 'fetch_failed', message: e.message };
  }
}

async function findTeamByKey(key) {
  const d = await graphql(`{ teams(filter: { key: { eq: "${key}" } }) { nodes { id name } } }`);
  const team = d.data && d.data.teams && d.data.teams.nodes[0];
  if (!team) throw new Error(`Team ${key} not found`);
  return team;
}

async function findWorkflowState(teamId, stateName) {
  const d = await graphql(`{ workflowStates(filter: { team: { id: { eq: "${teamId}" } } }) { nodes { id name } } }`);
  const state = d.data && d.data.workflowStates && d.data.workflowStates.nodes.find(s => s.name === stateName);
  if (!state) throw new Error(`State "${stateName}" not found for team`);
  return state.id;
}

async function getIssueTeamId(issueId) {
  const d = await graphql(`{ issue(id: "${issueId}") { team { id } } }`);
  if (!d.data || !d.data.issue) throw new Error(`Issue ${issueId} not found`);
  return d.data.issue.team.id;
}

async function createLinearIssue({ title, description, teamId, priority, parentId }) {
  const mutation = `mutation { issueCreate(input: {
    title: ${JSON.stringify(title)},
    description: ${JSON.stringify(description || '')},
    teamId: "${teamId}",
    priority: ${priority || 2},
    ${parentId ? `parentId: "${parentId}",` : ''}
  }) { success issue { id identifier title } } }`;
  const d = await graphql(mutation);
  if (d.errors) throw new Error(d.errors[0].message);
  return d.data.issueCreate.issue;
}

async function attachAgentLabel(issueId, agentId) {
  const labelQuery = `{ issueLabels(filter: { name: { eq: "agent:${agentId}" } }) { nodes { id } } }`;
  const lr = await graphql(labelQuery);
  const label = lr.data && lr.data.issueLabels && lr.data.issueLabels.nodes[0];
  if (label) {
    await graphql(`mutation { issueUpdate(id: "${issueId}", input: { labelIds: { addIds: ["${label.id}"] } }) { success } }`);
  }
}

async function addComment(issueId, body) {
  await graphql(`mutation { commentCreate(input: { issueId: "${issueId}", body: ${JSON.stringify(body)} }) { success } }`);
}

async function transitionIssue(issueId, stateId) {
  await graphql(`mutation { issueUpdate(id: "${issueId}", input: { stateId: "${stateId}" }) { success } }`);
}

// ─── Agent activation ───
function startAgentWithLinearIssue(agentId, issue) {
  const agentDir = `/Users/openclaw/.openclaw/agents/${agentId}`;
  const sessionsDir = `${agentDir}/sessions`;

  if (fs.existsSync(sessionsDir)) {
    try {
      const lockFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.lock'));
      for (const f of lockFiles) {
        fs.unlinkSync(`${sessionsDir}/${f}`);
      }
    } catch (e) {}
  }

  const preamble = `You have been activated on Linear issue ${issue.identifier}: "${issue.title}". Your job is to work through this issue thoroughly. Mark it as "In Review" when done. Use curl to update Linear state via the GraphQL API - write scripts to /tmp/ if needed.`;

  try {
    const child = spawn('openclaw', [
      'agent', agentId,
      '--message', `${preamble}\n\nIssue: ${issue.identifier} - ${issue.title}\nDescription: ${issue.description || ''}`
    ], {
      cwd: agentDir,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, LINEAR_API_KEY, GITHUB_TOKEN },
    });
    child.unref();
  } catch (e) {
    console.error(`Failed to start agent ${agentId}: ${e.message}`);
  }

  return { success: true, activationId: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` };
}

// ─── Webhook handler ───
async function handleLinearWebhook(payload) {
  const { action, data } = payload;
  if (!data || !data.id || !action) return { handled: false, action: 'skipped: no issue data' };

  const newState = data.state && data.state.name;
  const identifier = data.identifier || 'Unknown';
  const title = data.title || 'No title';

  // ─── Issue moved to "Blocked" ───
  if (newState === 'Blocked') {
    const agentId = extractAgentFromLabels(data.labels && data.labels.nodes);
    sendTelegram(`${identifier} BLOCKED by ${agentId || 'unknown'}: "${title}"`);
    return { handled: true, action: `blocker: ${identifier} → Blocked, notified` };
  }

  if (newState !== 'In Review') {
    return { handled: true, action: `broadcast: ${identifier} → ${newState}` };
  }

  // ─── Issue moved to "In Review" ───
  const agentId = extractAgentFromLabels(data.labels && data.labels.nodes);
  if (!agentId) return { handled: true, action: `no agent label on ${identifier}, skipped pipeline` };

  // BA auto-route
  if (agentId === 'ba-platform') {
    const feMatch = title.match(/\[FE\]/);
    const beMatch = title.match(/\[BE\]/);
    let targetAgentId = null;
    if (feMatch) targetAgentId = 'frontend-em';
    else if (beMatch) targetAgentId = 'backend-em';

    if (targetAgentId) {
      try { await attachAgentLabel(data.id, targetAgentId); } catch (e) {}
      startAgentWithLinearIssue(targetAgentId, {
        identifier: identifier,
        title: title,
        description: data.description || '',
      });
      return { handled: true, action: `ba-auto-route: ${identifier} -> ${targetAgentId}` };
    }
  }

  // Pipeline auto-advance
  const nextAgents = getNextInPipeline(agentId);
  if (!nextAgents || nextAgents.length === 0) {
    return { handled: true, action: `pipeline end for ${agentId}` };
  }

  let teamId;
  const eventTeamKey = data.team && data.team.key;
  if (eventTeamKey) {
    try { const t = await findTeamByKey(eventTeamKey); teamId = t.id; } catch (e) {}
  }
  if (!teamId) {
    try { const t = await findTeamByKey('ORA'); teamId = t.id; } catch (e) {}
  }
  if (!teamId) return { handled: false, action: 'failed: could not find team' };

  let todoStateId;
  try { todoStateId = await findWorkflowState(teamId, 'Todo'); } catch (e) { return { handled: false, action: 'failed: no Todo state' }; }

  for (const nextAgentId of nextAgents) {
    try {
      const nextIssue = await createLinearIssue({
        title: `Review: ${title}`,
        description: `Auto-created from pipeline after ${agentId} completed ${identifier}: ${title}`,
        teamId,
        priority: 2,
        parentId: data.id,
      });

      await attachAgentLabel(nextIssue.id, nextAgentId);
      await addComment(data.id, `Pipeline: Created ${nextIssue.identifier} for ${getAgentDisplayName(nextAgentId)}`).catch(() => {});

      try { await transitionIssue(nextIssue.id, todoStateId); } catch (e) {}

      startAgentWithLinearIssue(nextAgentId, {
        identifier: nextIssue.identifier,
        title: `Review: ${title}`,
        description: `Auto-created from pipeline after ${agentId} completed ${identifier}`,
      });

      console.log(`Pipeline: ${identifier} → ${nextIssue.identifier} → ${nextAgentId}`);
    } catch (e) {
      console.error(`Pipeline: failed to create ticket for ${nextAgentId}: ${e.message}`);
    }
  }

  return { handled: true, action: `pipeline: ${identifier} completed by ${agentId}` };
}

// ─── Telegram helper ───
function sendTelegram(text) {
  try {
    const postData = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    });
    req.write(postData);
    req.end();
  } catch (e) {
    console.warn('Telegram send failed:', e.message);
  }
}

// ─── GitHub sync ───
async function syncGitHubTickets() {
  if (!GITHUB_TOKEN) return { issues: 0, prs: 0 };
  const repos = ['nimphiusBot/orange-hr-dashboard', 'orange-doorhouse/storyhouse-main', 'orange-doorhouse/storyhouse-design-system'];
  let totalIssues = 0, totalPRs = 0;

  for (const repo of repos) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=20`, {
        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
      });
      const data = await r.json();
      if (Array.isArray(data)) {
        totalIssues += data.filter(i => !i.pull_request).length;
        totalPRs += data.filter(i => i.pull_request).length;
      }
    } catch (e) {
      console.error(`GitHub sync failed for ${repo}: ${e.message}`);
    }
  }
  return { issues: totalIssues, prs: totalPRs };
}

// ─── Stale blocker checker ───
async function checkStaleBlockers() {
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const d = await graphql(`{
      issues(filter: { team: { key: { eq: "ORA" } }, state: { name: { eq: "Blocked" } }, updatedAt: { lt: "${dayAgo}" } }) {
        nodes { identifier title updatedAt labels { nodes { name } } }
      }
    }`);
    var gqlData = d.data || {};
    const staleBlockers = (gqlData.issues && gqlData.issues.nodes) || [];
    if (staleBlockers.length > 0) {
      let msg = `⚠️ *Stale Blocker Alert* — ${staleBlockers.length} ticket(s) blocked >24h:\n\n`;
      for (const issue of staleBlockers) {
        msg += `• \`${issue.identifier}\` — ${issue.title}\n`;
      }
      sendTelegram(msg);
    }
  } catch (e) {
    console.warn('Stale blocker check failed:', e.message);
  }
}

// ─── Express app ───
const app = express();
const PORT = process.env.PORT || 3003;

const wss = new WebSocketServer({ port: 3004 });
wss.on('error', function() { /* Port in use locally - non-fatal */ });

const clients = new Set();

wss.on('connection', function(ws) {
  clients.add(ws);
  ws.on('close', function() { clients.delete(ws); });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(function(c) { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', function(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/webhook/linear', async function(req, res) {
  const event = req.body;
  console.log('📨 Linear webhook:', event.type || event.action || 'unknown');
  if (event.data && event.data.id && event.action) {
    try {
      const result = await handleLinearWebhook(event);
      console.log('📨 Webhook:', result.handled ? '✓' : '✗', result.action);
    } catch (e) {
      console.error('❌ Webhook handler error:', e.message);
    }
  }
  res.json({ success: true, message: 'Webhook processed' });
});

app.get('/api/linear/issues', async function(req, res) {
  if (!LINEAR_API_KEY) return res.json({ success: false, issues: [] });
  try {
    const d = await graphql(`{
      issues(first: 50, filter: { team: { key: { eq: "ORA" } } }) {
        nodes {
          id identifier title
          state { name }
          team { key name }
          createdAt
          labels { nodes { name } }
        }
      }
    }`);
    const issues = (d.data && d.data.issues && d.data.issues.nodes || []).map(function(issue) {
      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        status: issue.state.name,
        team: issue.team.key,
        teamName: issue.team.name,
        createdAt: issue.createdAt,
        labels: (issue.labels.nodes || []).map(function(l) { return l.name; }),
        agentLabels: (issue.labels.nodes || [])
          .filter(function(l) { return l.name.startsWith('agent:'); })
          .map(function(l) { return l.name.replace('agent:', ''); }),
      };
    });
    res.json({ success: true, issues: issues });
  } catch (e) {
    res.json({ success: false, issues: [], error: e.message });
  }
});

app.get('/api/pipeline/state', async function(req, res) {
  if (!LINEAR_API_KEY) return res.json({ pipeline: null, error: 'No API key' });
  try {
    const d = await graphql(`{
      issues(first: 50, filter: { team: { key: { eq: "ORA" } } }) {
        nodes {
          identifier title
          state { name }
          labels { nodes { name } }
          updatedAt
        }
      }
    }`);
    const issues = (d.data && d.data.issues && d.data.issues.nodes) || [];
    const stateOrder = ['Backlog', 'Todo', 'In Progress', 'In Review', 'Blocked', 'Done', 'Canceled'];
    const byState = {};
    issues.forEach(function(i) {
      var s = i.state.name;
      if (!byState[s]) byState[s] = { count: 0, tickets: [] };
      byState[s].count++;
      byState[s].tickets.push({
        id: i.identifier,
        title: i.title,
        agent: (i.labels.nodes || []).filter(function(l) { return l.name.startsWith('agent:'); }).map(function(l) { return l.name.replace('agent:', ''); }),
        updatedAt: i.updatedAt,
      });
    });
    var organizedStates = stateOrder.filter(function(s) { return byState[s]; }).map(function(s) { return { name: s, count: byState[s].count, tickets: byState[s].tickets }; });
    res.json({ pipeline: { states: organizedStates } });
  } catch (e) {
    res.json({ pipeline: null, error: e.message });
  }
});

// ─── Start ───
app.listen(PORT, function() {
  console.log('🚀 HR Dashboard backend on port ' + PORT);
  console.log('🔗 Webhook: POST /webhook/linear');
  console.log('🔗 Pipeline: GET /api/pipeline/state');

  setInterval(checkStaleBlockers, 30 * 60 * 1000);

  setTimeout(function() {
    syncGitHubTickets()
      .then(function(r) { console.log('📦 GitHub: ' + r.issues + ' issues, ' + r.prs + ' PRs'); })
      .catch(function() {});
  }, 5000);
  setInterval(function() { syncGitHubTickets().catch(function() {}); }, 60 * 1000);

  console.log('\n📋 LINEAR_API_KEY: ' + (LINEAR_API_KEY ? '✅' : '❌'));
  console.log('📋 GITHUB_TOKEN: ' + (GITHUB_TOKEN ? '✅' : '❌'));
});
